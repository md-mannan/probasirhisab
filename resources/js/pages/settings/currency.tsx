import { Form, Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { edit, update } from '@/routes/currency';

type Props = {
    supported: Record<string, { label: string; decimals: number }>;
    primary: string;
    secondary: string;
    canConfigureExchangeApi: boolean;
    exchangeRateApiUrl: string | null;
    hasExchangeRateApiKey: boolean;
    configured: boolean;
    rateLine: string | null;
};

export default function CurrencySettings({
    supported,
    primary,
    secondary,
    canConfigureExchangeApi,
    exchangeRateApiUrl,
    hasExchangeRateApiKey,
    configured,
    rateLine,
}: Props) {
    const [primaryCurrency, setPrimaryCurrency] = useState(primary);
    const [secondaryCurrency, setSecondaryCurrency] = useState(secondary);

    const supportedEntries = useMemo(() => Object.entries(supported), [supported]);

    const description = canConfigureExchangeApi
        ? 'Set your primary/secondary currency and the organization exchange-rate API.'
        : 'Set your primary and secondary currency. Rates use the API configured by an administrator.';

    return (
        <>
            <Head title="Currency settings" />

            <h1 className="sr-only">Currency settings</h1>

            <div className="space-y-6">
                <Heading variant="small" title="Currency" description={description} />

                <Form
                    action={update.url()}
                    method="patch"
                    options={{ preserveScroll: true }}
                    className="space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="primary_currency">
                                    Primary currency
                                </Label>

                                <input
                                    type="hidden"
                                    name="primary_currency"
                                    value={primaryCurrency}
                                />
                                <Select
                                    value={primaryCurrency}
                                    onValueChange={setPrimaryCurrency}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a currency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {supportedEntries.map(([code, meta]) => (
                                            <SelectItem key={code} value={code}>
                                                {meta.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <InputError
                                    className="mt-2"
                                    message={errors.primary_currency}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="secondary_currency">
                                    Secondary currency
                                </Label>

                                <input
                                    type="hidden"
                                    name="secondary_currency"
                                    value={secondaryCurrency}
                                />
                                <Select
                                    value={secondaryCurrency}
                                    onValueChange={setSecondaryCurrency}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a currency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {supportedEntries.map(([code, meta]) => (
                                            <SelectItem key={code} value={code}>
                                                {meta.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <InputError
                                    className="mt-2"
                                    message={errors.secondary_currency}
                                />
                            </div>

                            {canConfigureExchangeApi && (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="exchange_rate_api_url">
                                            Exchange rate API URL
                                        </Label>

                                        <Input
                                            id="exchange_rate_api_url"
                                            name="exchange_rate_api_url"
                                            defaultValue={exchangeRateApiUrl ?? ''}
                                            placeholder="https://v6.exchangerate-api.com/v6/{key}/latest/{base}"
                                        />

                                        <p className="text-xs text-muted-foreground">
                                            Use placeholders: <code>{'{base}'}</code>{' '}
                                            and <code>{'{key}'}</code>.
                                        </p>

                                        <InputError
                                            className="mt-2"
                                            message={errors.exchange_rate_api_url}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="exchange_rate_api_key">
                                            Exchange rate API key
                                        </Label>

                                        <Input
                                            id="exchange_rate_api_key"
                                            name="exchange_rate_api_key"
                                            type="password"
                                            placeholder={
                                                hasExchangeRateApiKey
                                                    ? 'Leave blank to keep current key'
                                                    : 'Paste your API key'
                                            }
                                        />

                                        <InputError
                                            className="mt-2"
                                            message={errors.exchange_rate_api_key}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="rounded-md border border-border/70 bg-card p-4 text-sm">
                                {configured ? (
                                    rateLine ? (
                                        <span>{rateLine}</span>
                                    ) : (
                                        <span className="text-muted-foreground">
                                            API configured, but rate is unavailable right
                                            now.
                                        </span>
                                    )
                                ) : canConfigureExchangeApi ? (
                                    <span className="text-muted-foreground">
                                        Set your API URL (and key if needed), then save to
                                        see the rate.
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">
                                        An administrator must configure the organization
                                        exchange rate API before conversion rates appear
                                        here.
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-4">
                                <Button disabled={processing}>Save</Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

CurrencySettings.layout = {
    breadcrumbs: [
        {
            title: 'Currency',
            href: edit(),
        },
    ],
};
