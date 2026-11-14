<?php
declare(strict_types=1);

final class Environment
{
    public static function load(string $path): void
    {
        if (!is_file($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES);
        if ($lines === false) {
            throw new RuntimeException('Unable to read backend environment file.');
        }

        foreach ($lines as $lineNumber => $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            if (!str_contains($line, '=')) {
                throw new RuntimeException(
                    'Invalid backend environment entry on line ' . ($lineNumber + 1) . '.',
                );
            }

            [$name, $value] = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);

            if (!preg_match('/^[A-Z][A-Z0-9_]*$/', $name)) {
                throw new RuntimeException(
                    'Invalid backend environment variable name on line ' . ($lineNumber + 1) . '.',
                );
            }

            if (getenv($name) !== false) {
                continue;
            }

            if (
                strlen($value) >= 2 &&
                (($value[0] === '"' && $value[strlen($value) - 1] === '"') ||
                    ($value[0] === "'" && $value[strlen($value) - 1] === "'"))
            ) {
                $value = substr($value, 1, -1);
            }

            putenv($name . '=' . $value);
            $_ENV[$name] = $value;
        }
    }

    public static function get(string $name, ?string $default = null): ?string
    {
        $value = getenv($name);
        return $value === false ? $default : $value;
    }
}
