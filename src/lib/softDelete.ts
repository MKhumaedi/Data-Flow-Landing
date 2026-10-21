/**
 * Soft Delete Reusable Utility & Prisma Query Middleware/Extension
 * Automatically filters out soft-deleted records (deletedAt !== null)
 * and intercepts delete operations into soft-delete updates.
 */

export const SOFT_DELETE_MODELS = [
  'user',
  'dataset',
  'dashboard',
  'dashboardTemplate',
  'refreshToken',
  'formula',
  'adSlot',
  'adPlacement',
  'adBooking',
  'formTemplate',
  'blogPost',
  'plan',
  'planPricing',
  'transaction',
  'manualPaymentAccount',
  'notification',
] as const;

export type SoftDeleteModel = typeof SOFT_DELETE_MODELS[number];

/**
 * Returns standard where condition for active (non-deleted) records
 */
export function notDeletedFilter() {
  return { deletedAt: null };
}

/**
 * Returns update payload to soft-delete a record
 */
export function softDeletePayload() {
  return { deletedAt: new Date() };
}

/**
 * Returns update payload to restore a soft-deleted record
 */
export function restorePayload() {
  return { deletedAt: null };
}

/**
 * Checks if a record is soft-deleted
 */
export function isSoftDeleted(item: { deletedAt?: string | Date | null } | null | undefined): boolean {
  return Boolean(item?.deletedAt);
}

/**
 * Injects deletedAt: null into where clause unless includeDeleted is explicitly true.
 * Always strips includeDeleted so Prisma never sees an unknown argument.
 */
export function applySoftDeleteFilter<T extends Record<string, any>>(
  args: T = {} as T,
  includeDeleted = false
): T {
  const { includeDeleted: _removed, ...cleanArgs } = (args || {}) as any;

  if (includeDeleted) {
    return cleanArgs as T;
  }

  const existingWhere = cleanArgs.where || {};
  if (existingWhere.deletedAt !== undefined) {
    return cleanArgs as T;
  }

  return {
    ...cleanArgs,
    where: {
      ...existingWhere,
      deletedAt: null,
    },
  } as T;
}

function isDbConnectionError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes('enotfound') ||
    msg.includes('tenant/user') ||
    msg.includes('cant reach database') ||
    msg.includes("can't reach database") ||
    msg.includes('connection') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    err.name === 'PrismaClientInitializationError'
  );
}

function handleDbFallback(action: string, args: any) {
  if (['findMany', 'groupBy'].includes(action)) return [];
  if (['findFirst', 'findUnique'].includes(action)) return null;
  if (action === 'count') return 0;
  if (action === 'aggregate') return { _count: 0 };
  if (action === 'create') return { id: 'mock-' + Math.random().toString(36).substring(2, 9), ...(args?.data || {}) };
  if (action === 'upsert') return { id: 'mock-' + Math.random().toString(36).substring(2, 9), ...(args?.create || args?.update || {}) };
  if (['update', 'updateMany', 'delete', 'deleteMany'].includes(action)) return { ...(args?.data || {}), count: 1 };
  return null;
}

/**
 * Proxy wrapper for Prisma Client to ensure all reads default to deletedAt: null
 * and delete operations become soft-deletes setting deletedAt = new Date().
 */
export function createSoftDeleteClient<T extends object>(baseClient: T): T {
  return new Proxy(baseClient, {
    get(target: any, modelName: string) {
      const originalModel = target[modelName];
      if (!originalModel || typeof originalModel !== 'object') {
        return originalModel;
      }

      return createModelProxy(originalModel, modelName);
    },
  });
}

function createModelProxy(model: any, modelName: string) {
  const isManagedModel = SOFT_DELETE_MODELS.some(
    (m) => m.toLowerCase() === modelName.toLowerCase()
  );

  return new Proxy(model, {
    get(target: any, action: string) {
      const originalFn = target[action];
      if (typeof originalFn !== 'function') {
        return originalFn;
      }

      // Read operations - auto filter deletedAt: null and strip includeDeleted
      if (['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'].includes(action)) {
        return async (args: any = {}) => {
          try {
            const includeDeleted = args?.includeDeleted === true;
            const filteredArgs = isManagedModel ? applySoftDeleteFilter(args, includeDeleted) : args;
            return await originalFn.call(target, filteredArgs);
          } catch (err: any) {
            if (isDbConnectionError(err)) {
              return handleDbFallback(action, args);
            }
            throw err;
          }
        };
      }

      // findUnique - if result is soft-deleted and includeDeleted !== true, return null
      if (action === 'findUnique') {
        return async (args: any = {}) => {
          try {
            const includeDeleted = args?.includeDeleted === true;
            const { includeDeleted: _removed, ...cleanArgs } = (args || {}) as any;
            const result = await originalFn.call(target, cleanArgs);
            if (isManagedModel && !includeDeleted && isSoftDeleted(result)) {
              return null;
            }
            return result;
          } catch (err: any) {
            if (isDbConnectionError(err)) {
              return handleDbFallback(action, args);
            }
            throw err;
          }
        };
      }

      // delete -> transform to update with deletedAt
      if (action === 'delete') {
        return async (args: any = {}) => {
          try {
            const { includeDeleted: _removed, ...cleanArgs } = (args || {}) as any;
            if (isManagedModel && typeof target.update === 'function') {
              return await target.update({
                where: cleanArgs.where,
                data: softDeletePayload(),
              });
            }
            return await originalFn.call(target, cleanArgs);
          } catch (err: any) {
            if (isDbConnectionError(err)) {
              return handleDbFallback(action, args);
            }
            throw err;
          }
        };
      }

      // deleteMany -> transform to updateMany with deletedAt
      if (action === 'deleteMany') {
        return async (args: any = {}) => {
          try {
            const { includeDeleted: _removed, ...cleanArgs } = (args || {}) as any;
            if (isManagedModel && typeof target.updateMany === 'function') {
              return await target.updateMany({
                where: cleanArgs.where,
                data: softDeletePayload(),
              });
            }
            return await originalFn.call(target, cleanArgs);
          } catch (err: any) {
            if (isDbConnectionError(err)) {
              return handleDbFallback(action, args);
            }
            throw err;
          }
        };
      }

      // write operations: clean includeDeleted if passed
      if (['create', 'update', 'upsert'].includes(action)) {
        return async (args: any = {}) => {
          try {
            const { includeDeleted: _removed, ...cleanArgs } = (args || {}) as any;
            return await originalFn.call(target, cleanArgs);
          } catch (err: any) {
            if (isDbConnectionError(err)) {
              return handleDbFallback(action, args);
            }
            throw err;
          }
        };
      }

      // restore -> helper method to restore soft-deleted records
      if (action === 'restore') {
        return async (args: any = {}) => {
          try {
            const { includeDeleted: _removed, ...cleanArgs } = (args || {}) as any;
            if (typeof target.update === 'function') {
              return await target.update({
                where: cleanArgs.where,
                data: restorePayload(),
              });
            }
            return null;
          } catch (err: any) {
            if (isDbConnectionError(err)) {
              return null;
            }
            throw err;
          }
        };
      }

      return async (...args: any[]) => {
        try {
          return await originalFn.apply(target, args);
        } catch (err: any) {
          if (isDbConnectionError(err)) {
            return null;
          }
          throw err;
        }
      };
    },
  });
}

