export type DashboardTileKey =
    | 'cash'
    | 'income'
    | 'expenses'
    | 'cost'
    | 'payables_due'
    | 'receivables_due'
    | 'net_position';

export type TrendChartDatasetKey =
    | 'income'
    | 'expense'
    | 'payable_settled'
    | 'payable_remainder'
    | 'receivable_settled'
    | 'receivable_remainder';

export type DashboardTranslations = {
    meta: {
        title: string;
    };
    carousel: {
        prev: string;
        next: string;
        slide_summary: string;
        slide_payables: string;
        slide_trends: string;
        region_label: string;
    };
    reorder_hint: string;
    drag_aria: string;
    section_payables_receivables: string;
    no_entries: string;
    trends_heading: string;
    trends: {
        monthly_title: string;
        monthly_empty: string;
        yearly_title: string;
        yearly_empty: string;
    };
    tiles: Record<DashboardTileKey, string>;
    cost_rows: {
        expenses: string;
        payables_settled: string;
        total: string;
    };
    obligation: {
        total: string;
        settled: string;
        remaining: string;
    };
    financial: {
        total_payable: string;
        total_receivable: string;
    };
    chart: {
        income: string;
        expense: string;
        payable_settled: string;
        payable_remainder: string;
        receivable_settled: string;
        receivable_remainder: string;
        legend_income: string;
        legend_expense: string;
        legend_payable: string;
        legend_receivable: string;
    };
    tooltip: {
        income: string;
        expense: string;
        payable: string;
        receivable: string;
        settled: string;
    };
    strip: {
        settled_word: string;
        total_word: string;
        settled_colon: string;
        remaining_colon: string;
        bar_remaining: string;
        bar_settled: string;
        progress_aria: string;
    };
};
