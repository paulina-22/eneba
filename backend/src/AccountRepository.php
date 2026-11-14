<?php
declare(strict_types=1);

final class AccountRepository
{
    public function __construct(private PDO $database)
    {
    }

    public function profile(int $userId): ?array
    {
        $statement = $this->database->prepare(
            'SELECT id, name, email, created_at
             FROM users
             WHERE id = :user_id
             LIMIT 1',
        );
        $statement->execute(['user_id' => $userId]);
        $user = $statement->fetch();
        if ($user === false) {
            return null;
        }

        return [
            'id' => (int) $user['id'],
            'name' => (string) $user['name'],
            'email' => (string) $user['email'],
            'createdAt' => (string) $user['created_at'],
        ];
    }

    public function ordersForUser(int $userId): array
    {
        $ordersStatement = $this->database->prepare(
            'SELECT o.id, o.status, o.total, o.currency, o.created_at,
                    pm.status AS payment_status
             FROM orders o
             LEFT JOIN payments pm ON pm.order_id = o.id
             WHERE o.user_id = :user_id
             ORDER BY o.created_at DESC, o.id DESC',
        );
        $ordersStatement->execute(['user_id' => $userId]);

        $orders = [];
        foreach ($ordersStatement->fetchAll() as $order) {
            $orderId = (int) $order['id'];
            $orders[$orderId] = [
                'id' => $orderId,
                'status' => (string) $order['status'],
                'paymentStatus' => $order['payment_status'] !== null
                    ? (string) $order['payment_status']
                    : null,
                'total' => (float) $order['total'],
                'currency' => (string) $order['currency'],
                'createdAt' => (string) $order['created_at'],
                'items' => [],
            ];
        }

        if ($orders === []) {
            return ['orders' => []];
        }

        $itemsStatement = $this->database->prepare(
            'SELECT oi.id AS order_item_id, oi.order_id, p.slug AS product_slug,
                    oi.product_name_snapshot,
                    oi.seller_name_snapshot, oi.unit_price, oi.quantity,
                    dk.key_value, dk.delivered_at
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
             JOIN products p ON p.id = oi.product_id
             LEFT JOIN payments pm ON pm.order_id = o.id
             LEFT JOIN digital_keys dk
               ON dk.assigned_order_item_id = oi.id
              AND dk.status = :key_status
              AND o.status = :paid_order_status
              AND pm.status = :succeeded_payment_status
             WHERE o.user_id = :user_id
             ORDER BY o.created_at DESC, oi.id, dk.id',
        );
        $itemsStatement->execute([
            'user_id' => $userId,
            'key_status' => 'assigned',
            'paid_order_status' => 'paid',
            'succeeded_payment_status' => 'succeeded',
        ]);

        $itemIndexes = [];
        foreach ($itemsStatement->fetchAll() as $item) {
            $orderId = (int) $item['order_id'];
            $orderItemId = (int) $item['order_item_id'];
            if (!isset($itemIndexes[$orderItemId])) {
                $orders[$orderId]['items'][] = [
                    'id' => $orderItemId,
                    'slug' => (string) $item['product_slug'],
                    'productName' => (string) $item['product_name_snapshot'],
                    'sellerName' => (string) $item['seller_name_snapshot'],
                    'unitPrice' => (float) $item['unit_price'],
                    'quantity' => (int) $item['quantity'],
                    'digitalKeys' => [],
                ];
                $itemIndexes[$orderItemId] = array_key_last($orders[$orderId]['items']);
            }

            if ($item['key_value'] !== null) {
                $orders[$orderId]['items'][$itemIndexes[$orderItemId]]['digitalKeys'][] = [
                    'value' => (string) $item['key_value'],
                    'deliveredAt' => $item['delivered_at'] !== null
                        ? (string) $item['delivered_at']
                        : null,
                ];
            }
        }

        return ['orders' => array_values($orders)];
    }
}
