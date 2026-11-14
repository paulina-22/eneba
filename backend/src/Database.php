<?php
declare(strict_types=1);

final class Database
{
    public static function connect(): PDO
    {
        $host = Environment::get('DB_HOST', '127.0.0.1');
        $port = Environment::get('DB_PORT', '3306');
        $database = self::required('DB_NAME');
        $username = self::required('DB_USER');
        $password = Environment::get('DB_PASSWORD', '');

        if ($host === null || !preg_match('/^[A-Za-z0-9._:-]+$/', $host)) {
            throw new RuntimeException('DB_HOST must be a valid hostname or IP address.');
        }

        if ($port === null || !ctype_digit($port) || (int) $port < 1 || (int) $port > 65535) {
            throw new RuntimeException('DB_PORT must be a valid TCP port.');
        }

        if (!preg_match('/^[A-Za-z0-9_]+$/', $database)) {
            throw new RuntimeException('DB_NAME may contain only letters, numbers, and underscores.');
        }

        return new PDO(
            sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $database),
            $username,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ],
        );
    }

    private static function required(string $name): string
    {
        $value = Environment::get($name);
        if ($value === null || trim($value) === '') {
            throw new RuntimeException($name . ' must be set in the backend environment.');
        }

        return trim($value);
    }
}
