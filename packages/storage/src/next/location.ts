/**
 * @license
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Functionality related to the parsing/composition of bucket/
 * object location.
 */
import * as errorsExports from '../implementation/error';
import { DEFAULT_HOST } from '../implementation/constants';

/**
 * @struct
 */
export class LocationNext {
  private path_: string;

  constructor(public readonly bucket: string, path: string) {
    this.path_ = path;
  }

  get path(): string {
    return this.path_;
  }

  set path(p: string) {
      this.path_ = p;
  }

  get isRoot(): boolean {
    return this.path.length === 0;
  }

  fullServerUrl(): string {
    const encode = encodeURIComponent;
    return '/b/' + encode(this.bucket) + '/o/' + encode(this.path);
  }

  bucketOnlyServerUrl(): string {
    const encode = encodeURIComponent;
    return '/b/' + encode(this.bucket) + '/o';
  }
}

export function makeFromBucketSpec(bucketString: string): LocationNext {
    let bucketLocation;
    try {
      bucketLocation = makeFromUrl(bucketString);
    } catch (e) {
      // Not valid URL, use as-is. This lets you put bare bucket names in
      // config.
      return new LocationNext(bucketString, '');
    }
    if (bucketLocation.path === '') {
      return bucketLocation;
    } else {
      throw errorsExports.invalidDefaultBucket(bucketString);
    }
  }

export function makeFromUrl(url: string): LocationNext {
    let location: LocationNext | null = null;
    const bucketDomain = '([A-Za-z0-9.\\-_]+)';

    function gsModify(loc: LocationNext): void {
      if (loc.path.charAt(loc.path.length - 1) === '/') {
        loc.path = loc.path.slice(0, -1);
      }
    }
    const gsPath = '(/(.*))?$';
    const path = '(/([^?#]*).*)?$';
    const gsRegex = new RegExp('^gs://' + bucketDomain + gsPath, 'i');
    const gsIndices = { bucket: 1, path: 3 };

    function httpModify(loc: LocationNext): void {
      loc.path = decodeURIComponent(loc.path);
    }
    const version = 'v[A-Za-z0-9_]+';
    const hostRegex = DEFAULT_HOST.replace(/[.]/g, '\\.');
    const httpRegex = new RegExp(
      `^https?://${hostRegex}/${version}/b/${bucketDomain}/o${path}`,
      'i'
    );
    const httpIndices = { bucket: 1, path: 3 };
    const groups = [
      { regex: gsRegex, indices: gsIndices, postModify: gsModify },
      { regex: httpRegex, indices: httpIndices, postModify: httpModify }
    ];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const captures = group.regex.exec(url);
      if (captures) {
        const bucketValue = captures[group.indices.bucket];
        let pathValue = captures[group.indices.path];
        if (!pathValue) {
          pathValue = '';
        }
        location = new LocationNext(bucketValue, pathValue);
        group.postModify(location);
        break;
      }
    }
    if (location == null) {
      throw errorsExports.invalidUrl(url);
    }
    return location;
  }