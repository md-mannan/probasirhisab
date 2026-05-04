import { Head, Link } from '@inertiajs/react';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dashboard } from '@/routes';

type Props = {
    status: number;
    title: string;
    description: string;
};

export default function ErrorPage({ status, title, description }: Props) {
    const isClientError = status >= 400 && status < 500;

    return (
        <>
            <Head title={title} />

            <div className="flex min-h-[calc(100vh-1px)] flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
                <div className="w-full max-w-md space-y-6 text-center">
                    <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-muted shadow-sm ring-1 ring-sidebar-border/60">
                        <AlertCircle
                            className={`size-8 ${isClientError ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'}`}
                            aria-hidden
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="font-mono text-sm tabular-nums text-muted-foreground">
                            {status}
                        </p>
                        <h1 className="text-balance text-xl font-semibold tracking-tight text-foreground">
                            {title}
                        </h1>
                        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                            {description}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                        <Button asChild variant="default" className="gap-2">
                            <Link href={dashboard()}>
                                <Home className="size-4" />
                                Back to dashboard
                            </Link>
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCw className="size-4" />
                            Try again
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
