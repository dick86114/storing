export type CategoryMutationKind =
  | 'save'
  | 'optimize'
  | 'reorder'
  | 'activate'
  | 'deactivate'
  | 'merge'
  | 'delete'
  | 'create';

export type CategoryMutationResult<T> =
  | { status: 'success'; value: T }
  | { status: 'failure'; error: unknown };

type CategoryMutationGate = {
  readonly active: CategoryMutationKind | null;
  tryAcquire: (kind: CategoryMutationKind) => boolean;
  release: (kind: CategoryMutationKind) => void;
};

export function createCategoryMutationGate(): CategoryMutationGate {
  let active: CategoryMutationKind | null = null;
  return {
    get active() {
      return active;
    },
    tryAcquire(kind) {
      if (active !== null) return false;
      active = kind;
      return true;
    },
    release(kind) {
      if (active === kind) active = null;
    },
  };
}

export function snapshotCategoryActionSource<T extends object>(source: T): T {
  return { ...source };
}

export async function runCommittedCategoryMutation<T>(options: {
  commit: () => Promise<T>;
  refresh?: () => Promise<unknown>;
  onCommitted: (value: T) => void;
  onFailure: (error: unknown) => void;
  onRefreshWarning?: (error: unknown) => void;
}): Promise<CategoryMutationResult<T>> {
  let value: T;
  try {
    value = await options.commit();
  } catch (error) {
    options.onFailure(error);
    return { status: 'failure', error };
  }

  options.onCommitted(value);

  if (options.refresh) {
    try {
      await options.refresh();
    } catch (error) {
      options.onRefreshWarning?.(error);
    }
  }

  return { status: 'success', value };
}
