import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function ScrollToTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setVisible(window.scrollY > 300);
        };

        window.addEventListener('scroll', onScroll, { passive: true });

        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollToTop = useCallback(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    if (!visible) {
        return null;
    }

    return (
        <Button
            onClick={scrollToTop}
            size="icon"
            className="fixed right-2 bottom-6 z-50 size-10 h-8 w-8 rounded-full shadow-lg"
            aria-label="Scroll to top"
        >
            <ArrowUp className="size-5" />
        </Button>
    );
}
