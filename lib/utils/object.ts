import cloneDeepWith from 'lodash/cloneDeepWith';
import isEqual from 'lodash/eq';
import forOwn from 'lodash/forOwn';
import getValue from 'lodash/get';
import isFunction from 'lodash/isFunction';
import isPlainObject from 'lodash/isPlainObject';
import mergeWith from 'lodash/mergeWith';
import { getComplexKeys } from './format';
// eslint-disable-next-line import/order -- caused by temporarily mixing require with import
import { camelize } from './string';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- .js files must be imported using require
const baseIsNative = require('lodash/_baseIsNative');

/**
 * Same concept as _.merge, but don't overwrite properties that have already been assigned
 *
 * @param a
 * @param b
 */
export function mergeDefaults(a: object, b: object) {
  return mergeWith(a, b, (objectValue, sourceValue) => {
    // If it's an object, let _ handle it this time, we will be called again for each property
    if (!isPlainObject(objectValue) && objectValue !== undefined) {
      // _.isNative includes a check for core-js and throws an error if present.
      // Depending on _baseIsNative bypasses the core-js check.
      if (isFunction(objectValue) && baseIsNative(objectValue)) {
        return sourceValue || objectValue;
      }

      return objectValue;
    }

    // eslint-disable-next-line consistent-return,no-useless-return -- lodash actually wants us to return `undefined` to fallback to the default customizer.
    return;
  });
}

// An alternative to _.merge, which doesn't clone its arguments
// Cloning is a bad idea because options arguments may contain references to sequelize
// models - which again reference database libs which don't like to be cloned (in particular pg-native)
export function merge(...args: object[]): object {
  const result: { [key: string]: any } = Object.create(null);

  for (const obj of args) {
    forOwn(obj, (value, key) => {
      if (value === undefined) {
        return;
      }

      if (!result[key]) {
        result[key] = value;
      } else if (isPlainObject(value) && isPlainObject(result[key])) {
        result[key] = merge(result[key], value);
      } else if (Array.isArray(value) && Array.isArray(result[key])) {
        result[key] = [...value, ...result[key]];
      } else {
        result[key] = value;
      }
    });
  }

  return result;
}

/* eslint-disable consistent-return -- lodash actually wants us to return `undefined` to fallback to the default customizer. */
export function cloneDeep<T extends object>(obj: T, onlyPlain?: boolean): T {
  return cloneDeepWith(obj || {}, elem => {
    // Do not try to customize cloning of arrays or POJOs
    if (Array.isArray(elem) || isPlainObject(elem)) {
      return;
    }

    // If we specified to clone only plain objects & arrays, we ignore everyhing else
    // In any case, don't clone stuff that's an object, but not a plain one - fx example sequelize models and instances
    if (onlyPlain || typeof elem === 'object') {
      return elem;
    }

    // Preserve special data-types like `fn` across clones. _.get() is used for checking up the prototype chain
    if (elem && typeof elem.clone === 'function') {
      return elem.clone();
    }
  });
}
/* eslint-enable consistent-return */

/**
 * Receives a tree-like object and returns a plain object which depth is 1.
 *
 * - Input:
 *
 *  {
 *    name: 'John',
 *    address: {
 *      street: 'Fake St. 123',
 *      coordinates: {
 *        longitude: 55.6779627,
 *        latitude: 12.5964313
 *      }
 *    }
 *  }
 *
 * - Output:
 *
 *  {
 *    name: 'John',
 *    address.street: 'Fake St. 123',
 *    address.coordinates.latitude: 55.6779627,
 *    address.coordinates.longitude: 12.5964313
 *  }
 *
 * @param {object} value an Object
 * @returns {object} a flattened object
 * @private
 */
export function flattenObjectDeep(value: object) {
  if (!isPlainObject(value)) {
    return value;
  }

  const flattenedObj: { [key: string]: any } = {};

  function flattenObject(obj: { [key: string]: any }, subPath?: string) {
    for (const key of Object.keys(obj)) {
      const pathToProperty = subPath ? `${subPath}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        flattenObject(obj[key], pathToProperty);
      } else {
        flattenedObj[pathToProperty] = getValue(obj, key);
      }
    }

    return flattenedObj;
  }

  return flattenObject(value);
}

/**
 * Assigns own and inherited enumerable string and symbol keyed properties of source
 * objects to the destination object.
 *
 * https://lodash.com/docs/4.17.4#defaults
 *
 * **Note:** This method mutates `object`.
 *
 * @param {object} objectIn The destination object.
 * @param {...object} [sources] The source objects.
 * @returns {object} Returns `object`.
 * @private
 */
export function defaults(
  objectIn: { [key: string | symbol]: any },
  ...sources: Array<{ [key: string | symbol]: any }>
): object {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const key of getComplexKeys(source)) {
      const value = objectIn[key];
      const objectPrototype: { [key: string | symbol]: any } = Object.prototype;

      if (
        value === undefined
        || isEqual(value, objectPrototype[key])
        && !Object.prototype.hasOwnProperty.call(objectIn, key)
      ) {
        objectIn[key] = source[key];
      }
    }
  }

  return objectIn;
}

/**
 * @param {object} obj
 * @returns {string} A new object with camel-cased keys
 * @private
 */
export function camelizeObjectKeys(obj: { [key: string]: any }) {
  const newObj: { [key: string]: any } = Object.create(null);

  for (const key of Object.keys(obj)) {
    newObj[camelize(key)] = obj[key];
  }

  return newObj;
}