/*
 Copyright 2021 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 *
 * ImageryTileData
 *  - Get ImageryTileLayer Data
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  4/6/2022 - 0.0.1 -
 * Modified:
 *
 */

class ImageryTileData extends EventTarget {

  static version = '0.0.1';

  layer;
  variableName;
  dimensionName;
  durations;

  constructor({layer, variableName, dimensionName, durations}) {
    super();

    this.layer = layer;
    this.variableName = variableName;
    this.dimensionName = dimensionName;
    this.durations = durations;

  }

  /**
   *
   * @param mapPoint
   * @returns {Promise<number[]>}
   */
  getData({mapPoint}) {
    return new Promise((resolve, reject) => {
      const getDataHandles = this.durations.map(duration => {
        return this._getData({mapPoint, duration});
      });
      Promise.all(getDataHandles).then(resolve).catch(reject);
    });
  }

  /**
   *
   * @param {Point} mapPoint
   * @param {number} duration
   * @returns {Promise<number>}
   * @private
   */
  _getData({mapPoint, duration}) {
    return new Promise((resolve, reject) => {
      this.layer.identify(mapPoint, {
        multidimensionalDefinition: [{
          variableName: this.variableName,
          dimensionName: this.dimensionName,
          values: [duration],
          isSlice: true
        }]
      }).then((identifyResults) => {
        const result = identifyResults.value;
        resolve({
          duration,
          startYear: (2019 - duration),
          endYear: 2019,
          valid: (result != null),
          slope: result?.[0],
          start: result?.[1],
          end: result?.[2]
        });
      }).catch(reject);
    });
  };

}

export default ImageryTileData;
