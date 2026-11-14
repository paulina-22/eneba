<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Environment.php';
require_once dirname(__DIR__) . '/src/Database.php';
require_once dirname(__DIR__) . '/src/ApiException.php';
require_once dirname(__DIR__) . '/src/AccountRepository.php';
require_once dirname(__DIR__) . '/src/AuthService.php';
require_once dirname(__DIR__) . '/src/CheckoutService.php';
require_once dirname(__DIR__) . '/src/MarketplaceRepository.php';
require_once dirname(__DIR__) . '/src/ProductReviewService.php';
require_once dirname(__DIR__) . '/src/SteamReviewsService.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    Environment::load(dirname(__DIR__) . '/.env');
} catch (RuntimeException $exception) {
    error_log('Marketplace environment configuration failed: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Backend configuration error. Check backend/.env.']);
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigin = Environment::get('APP_ALLOWED_ORIGIN');
if ($origin !== '' && $allowedOrigin !== null && hash_equals($allowedOrigin, $origin)) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Accept, Content-Type, X-CSRF-Token');
    header('Vary: Origin');
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function apiPath(): string
{
    $requestPath = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $scriptDirectory = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
    if ($scriptDirectory === '/' || $scriptDirectory === '.') {
        $scriptDirectory = '';
    }

    if ($scriptDirectory !== '' && str_starts_with($requestPath, $scriptDirectory . '/')) {
        $requestPath = substr($requestPath, strlen($scriptDirectory));
    }

    return '/' . trim($requestPath, '/');
}

function requestBody(): array
{
    $body = file_get_contents('php://input');
    if ($body === false) {
        throw new ApiException(400, 'Unable to read the request body.');
    }

    try {
        $payload = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new ApiException(400, 'Request body must contain valid JSON.');
    }

    if (!is_array($payload)) {
        throw new ApiException(400, 'Request body must be a JSON object.');
    }

    return $payload;
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($method, ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], true)) {
    header('Allow: GET, POST, PATCH, DELETE, OPTIONS');
    respond(405, ['error' => 'This request method is not supported.']);
}

try {
    $database = Database::connect();
    $accountRepository = new AccountRepository($database);
    $checkout = new CheckoutService($database);
    $repository = new MarketplaceRepository($database);
    $auth = new AuthService($database);
    $productReviews = new ProductReviewService($database);
    $path = apiPath();

    if ($path === '/api/v1/auth/me') {
        if ($method !== 'GET') {
            header('Allow: GET, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts GET requests.']);
        }
        respond(200, ['data' => $auth->currentSession()]);
    }

    if (in_array($path, ['/api/v1/auth/register', '/api/v1/auth/login', '/api/v1/auth/logout'], true)) {
        if ($method !== 'POST') {
            header('Allow: POST, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts POST requests.']);
        }
        $auth->requireCsrfToken();
        $body = requestBody();
        if ($path === '/api/v1/auth/register') {
            respond(201, ['data' => $auth->register($body)]);
        }
        if ($path === '/api/v1/auth/login') {
            respond(200, ['data' => $auth->login($body)]);
        }
        respond(200, ['data' => $auth->logout()]);
    }

    if ($path === '/api/v1/account' || $path === '/api/v1/account/orders') {
        if ($method !== 'GET') {
            header('Allow: GET, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts GET requests.']);
        }
        $user = $auth->requireUser();
        $userId = (int) $user['id'];
        $account = $path === '/api/v1/account'
            ? $accountRepository->profile($userId)
            : $accountRepository->ordersForUser($userId);
        if ($account === null) {
            respond(404, ['error' => 'Account not found.']);
        }
        respond(200, ['data' => $account]);
    }

    if ($path === '/api/v1/checkout/simulate-payment') {
        if ($method !== 'POST') {
            header('Allow: POST, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts POST requests.']);
        }
        $auth->requireCsrfToken();
        $user = $auth->requireUser();
        respond(201, [
            'data' => $checkout->simulatePayment((int) $user['id'], requestBody()),
        ]);
    }

    if (preg_match(
        '#^/api/v1/products/([a-z0-9][a-z0-9-]*)/community-reviews(?:/([1-9][0-9]*))?$#',
        $path,
        $matches,
    ) === 1) {
        $slug = $matches[1];
        $reviewId = isset($matches[2]) ? (int) $matches[2] : null;

        if ($method === 'GET' && $reviewId === null) {
            $reviews = $productReviews->listForProduct($slug, $auth->optionalUserId());
            if ($reviews === null) {
                respond(404, ['error' => 'Product not found.']);
            }
            respond(200, ['data' => $reviews]);
        }

        if ($method === 'POST' && $reviewId === null) {
            $auth->requireCsrfToken();
            $user = $auth->requireUser();
            respond(201, ['data' => $productReviews->create($slug, (int) $user['id'], requestBody())]);
        }

        if ($method === 'PATCH' && $reviewId !== null) {
            $auth->requireCsrfToken();
            $user = $auth->requireUser();
            respond(200, [
                'data' => $productReviews->update(
                    $slug,
                    $reviewId,
                    (int) $user['id'],
                    requestBody(),
                ),
            ]);
        }

        if ($method === 'DELETE' && $reviewId !== null) {
            $auth->requireCsrfToken();
            $user = $auth->requireUser();
            respond(200, [
                'data' => $productReviews->delete($slug, $reviewId, (int) $user['id']),
            ]);
        }

        header('Allow: GET, POST, PATCH, DELETE, OPTIONS');
        respond(405, ['error' => 'This review endpoint does not accept that request method.']);
    }

    if ($path === '/api/v1/health') {
        if ($method !== 'GET') {
            header('Allow: GET, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts GET requests.']);
        }
        $repository->checkConnection();
        respond(200, ['data' => ['status' => 'ok']]);
    }

    if ($path === '/api/v1/products') {
        if ($method !== 'GET') {
            header('Allow: GET, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts GET requests.']);
        }
        respond(200, ['data' => $repository->products($_GET)]);
    }

    if (preg_match('#^/api/v1/products/([a-z0-9][a-z0-9-]*)/reviews$#', $path, $matches) === 1) {
        if ($method !== 'GET') {
            header('Allow: GET, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts GET requests.']);
        }
        $reviews = (new SteamReviewsService($database))->reviewsForProduct($matches[1]);
        if ($reviews === null) {
            respond(404, ['error' => 'Product not found.']);
        }
        respond(200, ['data' => $reviews]);
    }

    if (preg_match('#^/api/v1/products/([a-z0-9][a-z0-9-]*)$#', $path, $matches) === 1) {
        if ($method !== 'GET') {
            header('Allow: GET, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts GET requests.']);
        }
        $product = $repository->product($matches[1]);
        if ($product === null) {
            respond(404, ['error' => 'Product not found.']);
        }
        respond(200, ['data' => $product]);
    }

    if ($path === '/api/v1/home/banners') {
        if ($method !== 'GET') {
            header('Allow: GET, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts GET requests.']);
        }
        $banners = $repository->banners();
        if ($banners === []) {
            respond(404, ['error' => 'Homepage promotional banners were not found.']);
        }
        respond(200, ['data' => $banners]);
    }

    if ($path === '/api/v1/home/banner' || $path === '/api/v1/home/hero') {
        if ($method !== 'GET') {
            header('Allow: GET, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts GET requests.']);
        }
        $hero = $repository->hero();
        if ($hero === null) {
            respond(404, ['error' => 'Homepage banner content was not found.']);
        }
        respond(200, ['data' => $hero]);
    }

    $productSections = [
        '/api/v1/home/best-sellers' => 'best-sellers',
        '/api/v1/home/popular-games' => 'popular-games',
        '/api/v1/home/deals' => 'deals',
        '/api/v1/home/trending' => 'trending',
        '/api/v1/home/new-arrivals' => 'new-arrivals',
    ];
    if (isset($productSections[$path])) {
        if ($method !== 'GET') {
            header('Allow: GET, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts GET requests.']);
        }
        $section = $repository->productSection($productSections[$path]);
        if ($section === null) {
            respond(404, ['error' => 'Homepage section content was not found.']);
        }
        respond(200, ['data' => $section]);
    }

    if ($path === '/api/v1/home/categories') {
        if ($method !== 'GET') {
            header('Allow: GET, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts GET requests.']);
        }
        $section = $repository->categorySection();
        if ($section === null) {
            respond(404, ['error' => 'Homepage category content was not found.']);
        }
        respond(200, ['data' => $section]);
    }

    if ($path === '/api/v1/home/platforms') {
        if ($method !== 'GET') {
            header('Allow: GET, OPTIONS');
            respond(405, ['error' => 'This endpoint only accepts GET requests.']);
        }
        $section = $repository->platformSection();
        if ($section === null) {
            respond(404, ['error' => 'Homepage platform content was not found.']);
        }
        respond(200, ['data' => $section]);
    }

    respond(404, ['error' => 'API endpoint not found.']);
} catch (ApiException $exception) {
    respond($exception->status, ['error' => $exception->getMessage()]);
} catch (InvalidArgumentException $exception) {
    respond(400, ['error' => $exception->getMessage()]);
} catch (PDOException $exception) {
    error_log('Marketplace database request failed: ' . $exception->getMessage());
    respond(503, ['error' => 'Database unavailable. Check backend/.env and ensure XAMPP MySQL is running.']);
} catch (RuntimeException $exception) {
    error_log('Marketplace backend configuration failed: ' . $exception->getMessage());
    respond(500, ['error' => 'Backend configuration error. Check backend/.env.']);
} catch (Throwable $exception) {
    error_log('Unhandled marketplace API error: ' . $exception->getMessage());
    respond(500, ['error' => 'An unexpected server error occurred.']);
}
