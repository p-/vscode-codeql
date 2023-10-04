import { ModeledMethod } from "./modeled-method";

/**
 * Converts a record of ModeledMethod[] indexed by signature to a record of a single ModeledMethod indexed by signature
 * for legacy usage. This function should always be used instead of the trivial conversion to track usages of this
 * conversion.
 *
 * This method should only be called inside a `onMessage` function (or its equivalent). If it's used anywhere else,
 * consider whether the boundary is correct: the boundary should as close as possible to the webview -> extension host
 * boundary.
 *
 * @param modeledMethods The record of ModeledMethod[] indexed by signature
 */
export function convertFromLegacyModeledMethods(
  modeledMethods: Record<string, ModeledMethod>,
): Record<string, ModeledMethod[]> {
  // Convert a single ModeledMethod to an array of ModeledMethods
  return Object.fromEntries(
    Object.entries(modeledMethods).map(([signature, modeledMethod]) => {
      return [signature, convertFromLegacyModeledMethod(modeledMethod)];
    }),
  );
}

/**
 * Converts a record of a single ModeledMethod indexed by signature to a record of ModeledMethod[] indexed by signature
 * for legacy usage. This function should always be used instead of the trivial conversion to track usages of this
 * conversion.
 *
 * This method should only be called inside a `postMessage` call. If it's used anywhere else, consider whether the
 * boundary is correct: the boundary should as close as possible to the extension host -> webview boundary.
 *
 * @param modeledMethods The record of a single ModeledMethod indexed by signature
 */
export function convertToLegacyModeledMethods(
  modeledMethods: Record<string, ModeledMethod[]>,
): Record<string, ModeledMethod> {
  // Always take the first modeled method in the array
  return Object.fromEntries(
    Object.entries(modeledMethods).map(([signature, modeledMethods]) => {
      return [signature, convertToLegacyModeledMethod(modeledMethods)];
    }),
  );
}

/**
 * Converts a single ModeledMethod to a ModeledMethod[] for legacy usage. This function should always be used instead
 * of the trivial conversion to track usages of this conversion.
 *
 * This method should only be called inside a `onMessage` function (or its equivalent). If it's used anywhere else,
 * consider whether the boundary is correct: the boundary should as close as possible to the webview -> extension host
 * boundary.
 *
 * @param modeledMethod The single ModeledMethod
 */
export function convertFromLegacyModeledMethod(modeledMethod: ModeledMethod) {
  return [modeledMethod];
}

/**
 * Converts a ModeledMethod[] to a single ModeledMethod for legacy usage. This function should always be used instead
 * of the trivial conversion to track usages of this conversion.
 *
 * This method should only be called inside a `postMessage` call. If it's used anywhere else, consider whether the
 * boundary is correct: the boundary should as close as possible to the extension host -> webview boundary.
 *
 * @param modeledMethods The ModeledMethod[]
 */
export function convertToLegacyModeledMethod(modeledMethods: ModeledMethod[]) {
  return modeledMethods[0];
}
