import type { ReactNode } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type ConfirmDeleteDialogProps = {
    /** The clickable element (usually an icon button) that opens the confirmation. */
    trigger: ReactNode;
    title: string;
    description: ReactNode;
    /** Label for the destructive confirm button. */
    confirmLabel?: string;
    /** Called when the user confirms the deletion. */
    onConfirm: () => void;
    disabled?: boolean;
};

/**
 * Wraps a trigger in an "are you sure?" confirmation so destructive actions
 * (deleting a transaction or settlement) can't happen from a single stray click.
 * Mirrors the AlertDialog usage already in settings/users.tsx.
 */
export function ConfirmDeleteDialog({
    trigger,
    title,
    description,
    confirmLabel = 'Delete',
    onConfirm,
    disabled = false,
}: ConfirmDeleteDialogProps) {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild disabled={disabled}>
                {trigger}
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        type="button"
                        onClick={onConfirm}
                        className={cn(
                            'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
                        )}
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
