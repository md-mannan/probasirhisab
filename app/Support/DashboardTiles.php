<?php

namespace App\Support;

final class DashboardTiles
{
    /** @var list<string> */
    public const IDS = [
        'cash',
        'income',
        'expenses',
        'cost',
        'payables_due',
        'receivables_due',
        'net_position',
    ];

    /**
     * @param  list<string>|null  $saved
     * @return list<string>
     */
    public static function normalize(?array $saved): array
    {
        if ($saved === null || $saved === []) {
            return self::IDS;
        }

        $seen = [];
        $out = [];
        foreach ($saved as $id) {
            if (in_array($id, self::IDS, true) && ! isset($seen[$id])) {
                $out[] = $id;
                $seen[$id] = true;
            }
        }
        foreach (self::IDS as $id) {
            if (! isset($seen[$id])) {
                $out[] = $id;
            }
        }

        return $out;
    }

    /**
     * @param  list<string>  $order
     */
    public static function isValidPermutation(array $order): bool
    {
        if (count($order) !== count(self::IDS)) {
            return false;
        }

        if (count(array_unique($order)) !== count($order)) {
            return false;
        }

        return empty(array_diff(self::IDS, $order));
    }
}
