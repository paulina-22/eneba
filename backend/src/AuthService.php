<?php
declare(strict_types=1);

final class AuthService
{
    public function __construct(private PDO $database)
    {
    }

    public function currentSession(): array
    {
        $this->startSession();
        $user = $_SESSION['user'] ?? null;
        if (is_array($user) && isset($user['id'])) {
            $statement = $this->database->prepare(
                'SELECT id, name, email FROM users WHERE id = :id LIMIT 1',
            );
            $statement->execute(['id' => (int) $user['id']]);
            $currentUser = $statement->fetch();
            if ($currentUser === false) {
                unset($_SESSION['user']);
                $user = null;
            } else {
                $user = $this->formatUser($currentUser);
                $_SESSION['user'] = $user;
            }
        } else {
            $user = null;
        }

        return [
            'user' => $user,
            'csrfToken' => $this->csrfToken(),
        ];
    }

    public function optionalUserId(): ?int
    {
        $sessionCookie = $_COOKIE[session_name()] ?? null;
        if (!is_string($sessionCookie) || $sessionCookie === '') {
            return null;
        }

        $session = $this->currentSession();
        return is_array($session['user']) ? (int) $session['user']['id'] : null;
    }

    public function register(array $input): array
    {
        $name = isset($input['name']) && is_string($input['name']) ? trim($input['name']) : '';
        $email = isset($input['email']) && is_string($input['email'])
            ? strtolower(trim($input['email']))
            : '';
        $password = isset($input['password']) && is_string($input['password'])
            ? $input['password']
            : '';
        $nameLength = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);

        if ($name === '' || $nameLength > 120) {
            throw new ApiException(400, 'Enter a name no longer than 120 characters.');
        }
        if (strlen($email) > 190 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new ApiException(400, 'Enter a valid email address.');
        }
        if (strlen($password) < 8 || strlen($password) > 72) {
            throw new ApiException(400, 'Password must be between 8 and 72 bytes.');
        }

        try {
            $statement = $this->database->prepare(
                'INSERT INTO users (name, email, password_hash)
                 VALUES (:name, :email, :password_hash)',
            );
            $statement->execute([
                'name' => $name,
                'email' => $email,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            ]);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                throw new ApiException(409, 'An account with that email address already exists.');
            }
            throw $exception;
        }

        return $this->startAuthenticatedSession([
            'id' => (int) $this->database->lastInsertId(),
            'name' => $name,
            'email' => $email,
        ]);
    }

    public function login(array $input): array
    {
        $email = isset($input['email']) && is_string($input['email'])
            ? strtolower(trim($input['email']))
            : '';
        $password = isset($input['password']) && is_string($input['password'])
            ? $input['password']
            : '';
        $statement = $this->database->prepare(
            'SELECT id, name, email, password_hash
             FROM users
             WHERE email = :email
             LIMIT 1',
        );
        $statement->execute(['email' => $email]);
        $user = $statement->fetch();

        if ($user === false || !password_verify($password, $user['password_hash'])) {
            throw new ApiException(401, 'Email or password is incorrect.');
        }

        return $this->startAuthenticatedSession($user);
    }

    public function logout(): array
    {
        $this->startSession();
        $_SESSION = [];
        session_regenerate_id(true);

        return [
            'user' => null,
            'csrfToken' => $this->csrfToken(),
        ];
    }

    public function requireCsrfToken(): void
    {
        $this->startSession();
        $sessionToken = $_SESSION['csrf_token'] ?? '';
        $requestToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($sessionToken)
            || $sessionToken === ''
            || !is_string($requestToken)
            || !hash_equals($sessionToken, $requestToken)
        ) {
            throw new ApiException(403, 'The request could not be verified. Refresh the page and try again.');
        }
    }

    public function requireUser(): array
    {
        $session = $this->currentSession();
        if (!is_array($session['user'])) {
            throw new ApiException(401, 'Sign in to access this resource.');
        }

        return $session['user'];
    }

    private function startAuthenticatedSession(array $user): array
    {
        $this->startSession();
        session_regenerate_id(true);
        $_SESSION = [
            'user' => $this->formatUser($user),
            'csrf_token' => bin2hex(random_bytes(32)),
        ];

        return [
            'user' => $_SESSION['user'],
            'csrfToken' => $_SESSION['csrf_token'],
        ];
    }

    private function startSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        ini_set('session.use_strict_mode', '1');
        $https = strtolower(trim(explode(',', (string) ($_SERVER['HTTPS'] ?? ''), 2)[0]));
        $forwardedProto = strtolower(trim(
            explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''), 2)[0],
        ));
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => ($https !== '' && $https !== 'off') || $forwardedProto === 'https',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        if (!session_start()) {
            throw new RuntimeException('Unable to start the authentication session.');
        }
    }

    private function csrfToken(): string
    {
        if (!isset($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }

        return $_SESSION['csrf_token'];
    }

    private function formatUser(array $user): array
    {
        return [
            'id' => (int) $user['id'],
            'name' => (string) $user['name'],
            'email' => (string) $user['email'],
        ];
    }
}
