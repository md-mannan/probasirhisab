import { Form, Head, router } from '@inertiajs/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    destroy as categoriesDestroy,
    index as categoriesIndex,
    store as categoriesStore,
    update as categoriesUpdate,
} from '@/routes/categories';

type Props = {
    types: Record<string, string>;
    categories: Array<{
        id: number;
        name: string;
        type: string;
        created_at: string;
    }>;
};

export default function CategoriesIndex({ types, categories }: Props) {
    const typeEntries = useMemo(() => Object.entries(types), [types]);
    const [createOpen, setCreateOpen] = useState(false);
    const [createType, setCreateType] = useState(
        typeEntries[0]?.[0] ?? 'income',
    );

    const [editOpen, setEditOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editType, setEditType] = useState(typeEntries[0]?.[0] ?? 'income');

    const openEdit = (c: Props['categories'][number]) => {
        setEditId(c.id);
        setEditName(c.name);
        setEditType(c.type);
        setEditOpen(true);
    };

    return (
        <>
            <Head title="Categories" />

            <div className="min-w-0 space-y-6 py-4 pb-6 sm:py-6">
                <div className="mb-0 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                        <Heading
                            title="Categories"
                            description="Create and manage your categories"
                        />
                    </div>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full shrink-0 sm:w-auto">
                                Create category
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create category</DialogTitle>
                                <DialogDescription>
                                    Choose a type and a name.
                                </DialogDescription>
                            </DialogHeader>

                            <Form
                                action={categoriesStore.url()}
                                method="post"
                                options={{ preserveScroll: true }}
                                className="grid gap-4"
                                onSuccess={() => setCreateOpen(false)}
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="type">Type</Label>
                                            <input
                                                type="hidden"
                                                name="type"
                                                value={createType}
                                            />
                                            <Select
                                                value={createType}
                                                onValueChange={setCreateType}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {typeEntries.map(
                                                        ([value, label]) => (
                                                            <SelectItem
                                                                key={value}
                                                                value={value}
                                                            >
                                                                {label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <InputError message={errors.type} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="name">
                                                Category name
                                            </Label>
                                            <Input
                                                id="name"
                                                name="name"
                                                placeholder="e.g. Salary, Rent, Groceries"
                                                required
                                            />
                                            <InputError message={errors.name} />
                                        </div>

                                        <DialogFooter>
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                Create
                                            </Button>
                                        </DialogFooter>
                                    </>
                                )}
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="rounded-xl border border-sidebar-border/70">
                    <div className="sticky top-16 z-20 grid grid-cols-12 gap-2 border-b border-sidebar-border/70 bg-muted px-4 py-2 text-sm font-medium">
                        <div className="col-span-4">Name</div>
                        <div className="col-span-4">Type</div>
                        <div className="col-span-4 text-right">Actions</div>
                    </div>
                    <div className="divide-y divide-sidebar-border/70">
                        {categories.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-muted-foreground">
                                No categories yet.
                            </div>
                        ) : (
                            categories.map((c) => (
                                <div
                                    key={c.id}
                                    className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm"
                                >
                                    <div className="col-span-4 font-medium">
                                        {c.name}
                                    </div>
                                    <div className="col-span-4 text-muted-foreground">
                                        {types[c.type] ?? c.type}
                                    </div>
                                    <div className="col-span-4 text-right">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => openEdit(c)}
                                            size="icon"
                                            aria-label="Edit category"
                                        >
                                            <Pencil className="size-4" />
                                        </Button>
                                        <ConfirmDeleteDialog
                                            title="Delete category?"
                                            description={
                                                <>
                                                    “{c.name}” will be removed.
                                                    Transactions using it will
                                                    keep their record but lose
                                                    this category. This cannot be
                                                    undone.
                                                </>
                                            }
                                            confirmLabel="Delete category"
                                            onConfirm={() =>
                                                router.delete(
                                                    categoriesDestroy.url({
                                                        category: c.id,
                                                    }),
                                                    {
                                                        preserveScroll: true,
                                                    },
                                                )
                                            }
                                            trigger={
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    className="text-destructive hover:text-destructive"
                                                    size="icon"
                                                    aria-label="Delete category"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            }
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit category</DialogTitle>
                            <DialogDescription>
                                Update the name or type.
                            </DialogDescription>
                        </DialogHeader>

                        {editId !== null && (
                            <Form
                                action={categoriesUpdate.url({
                                    category: editId,
                                })}
                                method="patch"
                                options={{ preserveScroll: true }}
                                className="grid gap-4"
                                onSuccess={() => setEditOpen(false)}
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="edit_type">
                                                Type
                                            </Label>
                                            <input
                                                type="hidden"
                                                name="type"
                                                value={editType}
                                            />
                                            <Select
                                                value={editType}
                                                onValueChange={setEditType}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {typeEntries.map(
                                                        ([value, label]) => (
                                                            <SelectItem
                                                                key={value}
                                                                value={value}
                                                            >
                                                                {label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <InputError message={errors.type} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="edit_name">
                                                Category name
                                            </Label>
                                            <Input
                                                id="edit_name"
                                                name="name"
                                                value={editName}
                                                onChange={(e) =>
                                                    setEditName(e.target.value)
                                                }
                                                required
                                            />
                                            <InputError message={errors.name} />
                                        </div>

                                        <DialogFooter>
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                Save
                                            </Button>
                                        </DialogFooter>
                                    </>
                                )}
                            </Form>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}

CategoriesIndex.layout = {
    breadcrumbs: [
        {
            title: 'Categories',
            href: categoriesIndex(),
        },
    ],
};
