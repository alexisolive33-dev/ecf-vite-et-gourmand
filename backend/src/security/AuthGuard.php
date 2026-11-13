<?php

namespace App\Security;

class AuthGuard
{
    private static function getSecret(): string
    {
        $secret = getenv('APP_SECRET') ?: getenv('DB_PASS');
        return ($secret && trim($secret) !== '')
            ? trim($secret)
            : 'ViteEtGourmand_ECF_2026_SecretKey!';
    }

    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder > 0) {
            $padLen = 4 - $remainder;
            $data .= str_repeat('=', $padLen);
        }
        return base64_decode(strtr($data, '-_', '+/')) ?: '';
    }

    /**
     * Génère un jeton signé (stateless HMAC-SHA256) contenant l'ID, l'email et le rôle
     */
    public static function generateToken(array $user): string
    {
        $dureeSeptJours = 604800;
        $payload = [
            'id'    => (int)$user['id'],
            'email' => (string)$user['email'],
            'role'  => strtolower(trim((string)($user['role'] ?? 'client'))),
            'exp'   => time() + $dureeSeptJours
        ];

        $encodedPayload = self::base64UrlEncode((string)json_encode($payload));
        $signature = hash_hmac('sha256', $encodedPayload, self::getSecret());

        return $encodedPayload . '.' . $signature;
    }

    /**
     * Extrait et vérifie le jeton Bearer depuis les en-têtes HTTP (compatible Apache / Render)
     */
    public static function getAuthenticatedUser(): ?array
    {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';

        if ($authHeader === '' && function_exists('getallheaders')) {
            foreach (getallheaders() as $name => $value) {
                if (strtolower((string)$name) === 'authorization') {
                    $authHeader = (string)$value;
                    break;
                }
            }
        }

        if (!preg_match('/Bearer\s+([^\s]+)/i', $authHeader, $matches)) {
            return null;
        }

        $parts = explode('.', $matches[1]);
        if (count($parts) !== 2) {
            return null;
        }

        [$encodedPayload, $signature] = $parts;
        $expectedSignature = hash_hmac('sha256', $encodedPayload, self::getSecret());

        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $payload = json_decode(self::base64UrlDecode($encodedPayload), true);
        if (!is_array($payload) || empty($payload['exp']) || time() > (int)$payload['exp']) {
            return null;
        }

        return $payload;
    }

    /**
     * Bloque la requête si l'utilisateur n'est pas connecté en tant qu'admin ou employe
     */
    public static function requireStaff(): array
    {
        $user = self::getAuthenticatedUser();

        if (!$user) {
            http_response_code(401);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Authentification requise (jeton manquant ou expiré).'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $role = strtolower(trim((string)($user['role'] ?? '')));
        if ($role !== 'admin' && $role !== 'employe') {
            http_response_code(403);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Accès refusé : privilèges administrateur ou employé requis.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        return $user;
    }
}