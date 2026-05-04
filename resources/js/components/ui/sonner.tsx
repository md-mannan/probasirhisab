import { useFlashToast } from '@/hooks/use-flash-toast';
import { useAppearance } from '@/hooks/use-appearance';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
    const { appearance } = useAppearance();

    useFlashToast();

    return (
        <Sonner
            theme={appearance}
            className="toaster group"
            closeButton
            position="bottom-right"
            style={
                {
                    '--normal-bg': 'var(--popover)',
                    '--normal-text': 'var(--popover-foreground)',
                    '--normal-border': 'var(--border)',
                    /* Sonner default is 356px; shrink to message + icon + close */
                    '--width': 'max-content',
                    maxWidth: 'calc(100vw - 2rem)',
                    /* LTR default puts the close control on the top-left; move inside top-right */
                    '--toast-close-button-start': 'unset',
                    '--toast-close-button-end': '0',
                    '--toast-close-button-transform': 'translate(35%, -35%)',
                } as React.CSSProperties
            }
            {...props}
        />
    );
}

export { Toaster };
