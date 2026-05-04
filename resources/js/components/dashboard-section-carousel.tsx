import {
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { DashboardTranslations } from '@/types/dashboard-i18n';

const SLIDE_COUNT = 3;

/** Taller viewport so summary cards / charts fit without clipping. */
const VIEWPORT_H =
    'h-[min(85vh,60rem)] min-h-[26rem] max-h-[min(85vh,60rem)]';

/** Ms between slide changes triggered by wheel */
const WHEEL_COOLDOWN_MS = 520;

type Props = {
    t: DashboardTranslations;
    cardsPanel: ReactNode;
    payablesPanel: ReactNode;
    trendsPanel: ReactNode;
};

export function DashboardSectionCarousel({
    t,
    cardsPanel,
    payablesPanel,
    trendsPanel,
}: Props) {
    const baseId = useId();
    const [active, setActive] = useState(0);
    const viewportRef = useRef<HTMLDivElement>(null);
    const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
    const cooldownUntilRef = useRef(0);

    const labels = [
        t.carousel.slide_summary,
        t.carousel.slide_payables,
        t.carousel.slide_trends,
    ] as const;

    const panels = [cardsPanel, payablesPanel, trendsPanel];

    const goPrev = useCallback(() => {
        setActive((i) => (i + SLIDE_COUNT - 1) % SLIDE_COUNT);
    }, []);

    const goNext = useCallback(() => {
        setActive((i) => (i + 1) % SLIDE_COUNT);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;

            if (
                tag === 'INPUT' ||
                tag === 'TEXTAREA' ||
                tag === 'SELECT' ||
                (e.target as HTMLElement)?.isContentEditable
            ) {
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                goNext();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                goPrev();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [goNext, goPrev]);

    useEffect(() => {
        const viewport = viewportRef.current;

        if (!viewport) {
            return;
        }

        const onWheel = (e: WheelEvent) => {
            const panel = panelRefs.current[active];

            if (!panel) {
                return;
            }

            const now = Date.now();

            if (now < cooldownUntilRef.current) {
                return;
            }

            const { scrollTop, scrollHeight, clientHeight } = panel;
            const epsilon = 3;
            const atTop = scrollTop <= epsilon;
            const atBottom =
                scrollTop + clientHeight >= scrollHeight - epsilon;
            const delta = e.deltaY;

            if (delta > 0 && atBottom) {
                e.preventDefault();
                cooldownUntilRef.current = now + WHEEL_COOLDOWN_MS;
                goNext();
            } else if (delta < 0 && atTop) {
                e.preventDefault();
                cooldownUntilRef.current = now + WHEEL_COOLDOWN_MS;
                goPrev();
            }
        };

        viewport.addEventListener('wheel', onWheel, { passive: false });

        return () => viewport.removeEventListener('wheel', onWheel);
    }, [active, goNext, goPrev]);

    return (
        <div className="space-y-2">
            <h2 id={`${baseId}-title`} className="sr-only">
                {labels[active]}
            </h2>

            <div
                ref={viewportRef}
                className={cn(
                    'relative overflow-hidden rounded-2xl border border-border/60 bg-muted/15 shadow-sm',
                    VIEWPORT_H,
                )}
                role="region"
                aria-roledescription="carousel"
                aria-label={t.carousel.region_label}
                aria-labelledby={`${baseId}-title`}
            >
                <nav
                    className="pointer-events-none absolute top-1/2 right-3 z-10 flex -translate-y-1/2 flex-col items-center gap-2.5 md:right-4"
                    aria-label={t.carousel.region_label}
                >
                    {labels.map((label, i) => (
                        <button
                            key={label}
                            type="button"
                            aria-label={label}
                            aria-current={i === active ? true : undefined}
                            className={cn(
                                'pointer-events-auto rounded-full border-2 border-transparent transition-[transform,background-color,border-color] motion-reduce:transition-none',
                                i === active
                                    ? 'size-3 scale-110 border-primary/35 bg-primary shadow-sm'
                                    : 'size-2 bg-muted-foreground/35 hover:bg-muted-foreground/55',
                            )}
                            onClick={() => setActive(i)}
                        />
                    ))}
                </nav>

                <div
                    className={cn(
                        'flex w-full flex-col motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out',
                        'motion-reduce:transition-none',
                    )}
                    style={{
                        transform: `translateY(calc(-${active} * 100% / ${SLIDE_COUNT}))`,
                    }}
                >
                    {panels.map((panel, i) => (
                        <div
                            key={labels[i]}
                            id={`${baseId}-panel-${i}`}
                            ref={(el) => {
                                panelRefs.current[i] = el;
                            }}
                            role="group"
                            aria-label={labels[i]}
                            aria-hidden={i !== active}
                            tabIndex={active === i ? 0 : -1}
                            className={cn(
                                'flex min-h-0 w-full shrink-0 flex-col overflow-y-auto overflow-x-hidden',
                                VIEWPORT_H,
                                'px-3 py-4 pr-10 sm:px-5 sm:py-5 sm:pr-11 md:px-6 md:pr-12',
                            )}
                        >
                            {panel}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
