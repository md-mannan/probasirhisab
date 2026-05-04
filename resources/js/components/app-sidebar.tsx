import { Link, usePage } from '@inertiajs/react';
import { ArrowLeftRight, LayoutGrid, Scale, ScrollText, Tags, Users } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { index as categoriesIndex } from '@/routes/categories';
import { index as contactsIndex } from '@/routes/contacts';
import { index as ledgerIndex } from '@/routes/ledger';
import reports from '@/routes/reports';
import { index as transactionsIndex } from '@/routes/transactions';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Categories',
        href: categoriesIndex(),
        icon: Tags,
    },
    {
        title: 'People',
        href: contactsIndex(),
        icon: Users,
    },
    {
        title: 'Transactions',
        href: transactionsIndex(),
        icon: ArrowLeftRight,
    },
    {
        title: 'Ledger',
        href: ledgerIndex(),
        icon: ScrollText,
    },
    {
        title: 'Balance Sheet',
        href: reports.balanceSheet(),
        icon: Scale,
    },
];

const footerNavItems: NavItem[] = [];

export function AppSidebar() {
    const { branding } = usePage().props;

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader className="pt-4 pb-4">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            asChild
                            tooltip={{ children: branding.appName }}
                        >
                            <Link href={dashboard()} prefetch>
                                <AppLogo placement="sidebar" />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
            </SidebarFooter>
        </Sidebar>
    );
}
