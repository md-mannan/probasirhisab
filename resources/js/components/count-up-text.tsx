import {
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';

function formatFixed(value: number, decimals: number): string {
    return value.toFixed(decimals);
}

function subscribeReducedMotion(onStoreChange: () => void): () => void {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', onStoreChange);

    return () => mq.removeEventListener('change', onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotionSnapshot,
        () => false,
    );
}

export type CountUpTextProps = {
    value: number;
    decimals: number;
    className?: string;
    /** Default ~0.9s */
    durationMs?: number;
};

/**
 * Animates a numeric amount toward `value` (ease-out), from the last rendered
 * amount or from zero on first mount. Respects `prefers-reduced-motion`.
 */
export function CountUpText({
    value,
    decimals,
    className,
    durationMs = 900,
}: CountUpTextProps) {
    const reduced = usePrefersReducedMotion();
    const target = Number.isFinite(value) ? value : 0;

    if (reduced) {
        return (
            <span className={className}>
                {formatFixed(target, decimals)}
            </span>
        );
    }

    return (
        <CountUpTextAnimated
            value={value}
            decimals={decimals}
            className={className}
            durationMs={durationMs}
        />
    );
}

function CountUpTextAnimated({
    value,
    decimals,
    className,
    durationMs = 900,
}: CountUpTextProps) {
    const target = Number.isFinite(value) ? value : 0;
    const displayRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    const [text, setText] = useState(() => formatFixed(0, decimals));

    useLayoutEffect(() => {
        let cancelled = false;
        const startFrom = displayRef.current;
        const duration = durationMs;

        const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

        const kickoff = () => {
            if (cancelled) {
                return;
            }

            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }

            if (Math.abs(target - startFrom) < 1e-12) {
                displayRef.current = target;
                setText(formatFixed(target, decimals));

                return;
            }

            let startTime: number | null = null;

            const tick = (now: number) => {
                if (cancelled) {
                    return;
                }

                if (startTime === null) {
                    startTime = now;
                }

                const elapsed = now - startTime;
                const t = Math.min(1, elapsed / duration);
                const eased = easeOutCubic(t);
                const next = startFrom + (target - startFrom) * eased;

                displayRef.current = next;
                setText(formatFixed(next, decimals));

                if (t < 1) {
                    rafRef.current = requestAnimationFrame(tick);
                } else {
                    displayRef.current = target;
                    setText(formatFixed(target, decimals));
                    rafRef.current = null;
                }
            };

            rafRef.current = requestAnimationFrame(tick);
        };

        const outerRaf = requestAnimationFrame(kickoff);

        return () => {
            cancelled = true;
            cancelAnimationFrame(outerRaf);

            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [target, decimals, durationMs]);

    return <span className={className}>{text}</span>;
}
