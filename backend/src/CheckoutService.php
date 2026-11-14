<?php
declare(strict_types=1);

final class CheckoutService
{
    public function __construct(private PDO $database)
    {
    }

    public function simulatePayment(int $userId, array $input): array
    {
        $requestedItems = $this->normalizeItems($input);
        $reference = 'SIM-' . strtoupper(str_replace('-', '', $this->requestId($input)));
        $existingOrder = $this->findPaidOrderByReference($userId, $reference);
        if ($existingOrder !== null) {
            return $this->formatExistingOrder($existingOrder, $requestedItems);
        }

        $this->database->beginTransaction();

        try {
            $offers = $this->lockActiveOffers(array_keys($requestedItems));
            if (count($offers) !== count($requestedItems)) {
                throw new ApiException(409, 'One or more selected offers are no longer available.');
            }

            $currencies = array_values(array_unique(array_column($offers, 'currency')));
            if (count($currencies) !== 1) {
                throw new ApiException(400, 'Checkout requires all selected offers to use one currency.');
            }

            $keysByOffer = [];
            $totalCents = 0;
            foreach ($requestedItems as $offerId => $quantity) {
                $offer = $offers[$offerId];
                $keyRows = $this->lockAvailableKeys($offerId, $quantity);
                if (count($keyRows) < $quantity) {
                    throw new ApiException(
                        409,
                        'Not enough demo keys are available for ' . $offer['product_name'] . '.',
                    );
                }

                $keysByOffer[$offerId] = array_map(
                    static fn(array $key): int => (int) $key['id'],
                    $keyRows,
                );
                $totalCents += $this->priceInCents((string) $offer['price']) * $quantity;
            }

            $currency = (string) $currencies[0];
            $total = number_format($totalCents / 100, 2, '.', '');
            $orderId = $this->createPendingOrder($userId, $total, $currency);

            foreach ($requestedItems as $offerId => $quantity) {
                $offer = $offers[$offerId];
                $orderItemId = $this->createOrderItem($orderId, $offerId, $quantity, $offer);
                $this->assignKeys($keysByOffer[$offerId], $orderItemId);
            }

            $paymentStatement = $this->database->prepare(
                'INSERT INTO payments (order_id, provider, status, reference)
                 VALUES (:order_id, :provider, :status, :reference)',
            );
            $paymentStatement->execute([
                'order_id' => $orderId,
                'provider' => 'simulated',
                'status' => 'succeeded',
                'reference' => $reference,
            ]);

            $orderStatement = $this->database->prepare(
                'UPDATE orders
                 SET status = :paid_status
                 WHERE id = :order_id AND user_id = :user_id AND status = :pending_status',
            );
            $orderStatement->execute([
                'paid_status' => 'paid',
                'order_id' => $orderId,
                'user_id' => $userId,
                'pending_status' => 'pending_payment',
            ]);
            if ($orderStatement->rowCount() !== 1) {
                throw new ApiException(500, 'The simulated payment did not complete. No order or keys were saved.');
            }

            $this->database->commit();

            return [
                'orderId' => $orderId,
                'status' => 'paid',
                'total' => (float) $total,
                'currency' => $currency,
            ];
        } catch (Throwable $exception) {
            if ($this->database->inTransaction()) {
                $this->database->rollBack();
            }
            if (($exception instanceof ApiException && $exception->status === 409)
                || ($exception instanceof PDOException && $exception->getCode() === '23000')
            ) {
                $existingOrder = $this->findPaidOrderByReference($userId, $reference);
                if ($existingOrder !== null) {
                    return $this->formatExistingOrder($existingOrder, $requestedItems);
                }
                if ($exception instanceof PDOException
                    && $exception->getCode() === '23000'
                    && $this->paymentReferenceExists($reference)
                ) {
                    throw new ApiException(409, 'This checkout request ID has already been used.');
                }
            }
            throw $exception;
        }
    }

    private function requestId(array $input): string
    {
        $requestId = $input['requestId'] ?? null;
        if (!is_string($requestId)
            || preg_match(
                '/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iD',
                $requestId,
            ) !== 1
        ) {
            throw new ApiException(400, 'A valid checkout request ID is required.');
        }
        return $requestId;
    }

    private function normalizeItems(array $input): array
    {
        $items = $input['items'] ?? null;
        if (!is_array($items) || !array_is_list($items) || $items === [] || count($items) > 25) {
            throw new ApiException(400, 'Add at least one and no more than 25 offers to checkout.');
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)
                || !isset($item['offerId'], $item['quantity'])
                || !is_int($item['offerId'])
                || !is_int($item['quantity'])
                || $item['offerId'] < 1
                || $item['quantity'] < 1
                || $item['quantity'] > 100
            ) {
                throw new ApiException(400, 'Each checkout item needs a valid offer and a quantity from 1 to 100.');
            }

            if (array_key_exists($item['offerId'], $normalized)) {
                throw new ApiException(400, 'Each selected offer must appear only once.');
            }
            $normalized[$item['offerId']] = $item['quantity'];
        }

        ksort($normalized, SORT_NUMERIC);
        return $normalized;
    }

    private function lockActiveOffers(array $offerIds): array
    {
        $placeholders = [];
        $parameters = [];
        foreach ($offerIds as $index => $offerId) {
            $placeholder = ':offer_' . $index;
            $placeholders[] = $placeholder;
            $parameters['offer_' . $index] = $offerId;
        }

        $statement = $this->database->prepare(
            'SELECT o.id, o.product_id, o.price, o.currency,
                    p.name AS product_name, s.display_name AS seller_name
             FROM offers o
             JOIN products p ON p.id = o.product_id
             JOIN sellers s ON s.id = o.seller_id
             WHERE o.id IN (' . implode(', ', $placeholders) . ')
               AND o.active = 1 AND p.active = 1
             ORDER BY o.id
             FOR UPDATE',
        );
        $statement->execute($parameters);

        $offers = [];
        foreach ($statement->fetchAll() as $offer) {
            $offers[(int) $offer['id']] = $offer;
        }
        return $offers;
    }

    private function lockAvailableKeys(int $offerId, int $quantity): array
    {
        $statement = $this->database->prepare(
            'SELECT id
             FROM digital_keys
             WHERE offer_id = :offer_id
               AND status = :available_status
               AND assigned_order_item_id IS NULL
             ORDER BY id
             LIMIT ' . $quantity . '
             FOR UPDATE',
        );
        $statement->execute([
            'offer_id' => $offerId,
            'available_status' => 'available',
        ]);
        return $statement->fetchAll();
    }

    private function createPendingOrder(int $userId, string $total, string $currency): int
    {
        $statement = $this->database->prepare(
            'INSERT INTO orders (user_id, status, total, currency)
             VALUES (:user_id, :status, :total, :currency)',
        );
        $statement->execute([
            'user_id' => $userId,
            'status' => 'pending_payment',
            'total' => $total,
            'currency' => $currency,
        ]);
        return (int) $this->database->lastInsertId();
    }

    private function createOrderItem(int $orderId, int $offerId, int $quantity, array $offer): int
    {
        $statement = $this->database->prepare(
            'INSERT INTO order_items (
                 order_id, product_id, offer_id, product_name_snapshot,
                 seller_name_snapshot, unit_price, quantity
             )
             VALUES (
                 :order_id, :product_id, :offer_id, :product_name,
                 :seller_name, :unit_price, :quantity
             )',
        );
        $statement->execute([
            'order_id' => $orderId,
            'product_id' => (int) $offer['product_id'],
            'offer_id' => $offerId,
            'product_name' => (string) $offer['product_name'],
            'seller_name' => (string) $offer['seller_name'],
            'unit_price' => (string) $offer['price'],
            'quantity' => $quantity,
        ]);
        return (int) $this->database->lastInsertId();
    }

    private function assignKeys(array $keyIds, int $orderItemId): void
    {
        $placeholders = [];
        $parameters = [
            'order_item_id' => $orderItemId,
            'assigned_status' => 'assigned',
            'available_status' => 'available',
        ];
        foreach ($keyIds as $index => $keyId) {
            $placeholder = ':key_' . $index;
            $placeholders[] = $placeholder;
            $parameters['key_' . $index] = $keyId;
        }

        $statement = $this->database->prepare(
            'UPDATE digital_keys
             SET status = :assigned_status,
                 assigned_order_item_id = :order_item_id,
                 delivered_at = CURRENT_TIMESTAMP
             WHERE id IN (' . implode(', ', $placeholders) . ')
               AND status = :available_status
               AND assigned_order_item_id IS NULL',
        );
        $statement->execute($parameters);
        if ($statement->rowCount() !== count($keyIds)) {
            throw new ApiException(409, 'Inventory changed during checkout. No order or keys were saved.');
        }
    }

    private function priceInCents(string $price): int
    {
        if (preg_match('/^([0-9]+)(?:\\.([0-9]{1,2}))?$/D', $price, $matches) !== 1) {
            throw new ApiException(500, 'The selected offer has an invalid price.');
        }

        return ((int) $matches[1] * 100) + (int) str_pad($matches[2] ?? '0', 2, '0');
    }

    private function findPaidOrderByReference(int $userId, string $reference): ?array
    {
        $statement = $this->database->prepare(
            'SELECT o.id, o.status, o.total, o.currency
             FROM payments pm
             JOIN orders o ON o.id = pm.order_id
             WHERE pm.reference = :reference
               AND pm.status = :payment_status
               AND o.status = :order_status
               AND o.user_id = :user_id
             LIMIT 1',
        );
        $statement->execute([
            'reference' => $reference,
            'payment_status' => 'succeeded',
            'order_status' => 'paid',
            'user_id' => $userId,
        ]);
        $order = $statement->fetch();
        if ($order === false) {
            return null;
        }

        $itemsStatement = $this->database->prepare(
            'SELECT offer_id, quantity
             FROM order_items
             WHERE order_id = :order_id
             ORDER BY offer_id',
        );
        $itemsStatement->execute(['order_id' => (int) $order['id']]);
        $order['items'] = [];
        foreach ($itemsStatement->fetchAll() as $item) {
            $order['items'][(int) $item['offer_id']] = (int) $item['quantity'];
        }
        return $order;
    }

    private function paymentReferenceExists(string $reference): bool
    {
        $statement = $this->database->prepare(
            'SELECT 1 FROM payments WHERE reference = :reference LIMIT 1',
        );
        $statement->execute(['reference' => $reference]);
        return $statement->fetchColumn() !== false;
    }

    private function formatExistingOrder(array $order, array $requestedItems): array
    {
        $existingItems = $order['items'];
        ksort($existingItems, SORT_NUMERIC);
        if ($existingItems !== $requestedItems) {
            throw new ApiException(409, 'This checkout request ID was already used for a different cart.');
        }

        return [
            'orderId' => (int) $order['id'],
            'status' => 'paid',
            'total' => (float) $order['total'],
            'currency' => (string) $order['currency'],
        ];
    }
}
