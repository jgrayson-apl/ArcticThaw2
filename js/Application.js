/*
 Copyright 2022 Esri

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

import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";
import ImageryTileData from './ImageryTileData.js';

class Application extends AppBase {

  // PORTAL //
  portal;

  // COLORS //
  WOODWELL_COLORS = {red: '#fa3817', white: '#ffffff', blue: '#439bff', location: '#00ff00'};

  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {

      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({app: this, viewConfig: this.viewConfig});
      applicationLoader.load().then(({portal, group, map, view}) => {
        //console.info(portal, group, map, view);

        // PORTAL //
        this.portal = portal;

        // APP TITLE //
        this.title = this.title || map?.portalItem?.title || 'Application';
        // APP DESCRIPTION //
        this.description = this.description || map?.portalItem?.description || group?.description || '...';

        // USER SIGN-IN //
        this.configUserSignIn();

        // APPLICATION //
        this.applicationReady({portal, group, map, view}).catch(this.displayError).then(() => {
          // HIDE APP LOADER //
          document.getElementById('app-loader').removeAttribute('active');
        });

      }).catch(this.displayError);
    }).catch(this.displayError);

  }

  /**
   *
   */
  configUserSignIn() {
    if (this.oauthappid || this.portal?.user) {

      const signIn = document.getElementById('sign-in');
      signIn && (signIn.portal = this.portal);

    }
  }

  /**
   *
   * @param view
   */
  configView(view) {
    return new Promise((resolve, reject) => {
      if (view) {
        require([
          'esri/widgets/Home',
          'esri/widgets/Search',
          'esri/widgets/LayerList',
          'esri/widgets/Legend'
        ], (Home, Search, LayerList, Legend) => {

          //
          // CONFIGURE VIEW SPECIFIC STUFF HERE //
          //
          view.set({
            //alphaCompositingEnabled: true,
            qualityProfile: "high",
            environment: {
              background: {
                type: "color",
                color: [255, 252, 244, 0]
              },
              starsEnabled: false,
              atmosphereEnabled: false,
              lighting: {
                type: "virtual"
              }
            }
          });

          // HOME //
          // const home = new Home({view});
          // view.ui.add(home, {position: 'top-left', index: 0});

          // LEGEND //
          /*
           const legend = new Legend({ view: view });
           view.ui.add(legend, {position: 'bottom-left', index: 0});
           */

          // SEARCH /
          const search = new Search({
            container: 'search-container',
            view: view,
            allPlaceholder: "Find place"
          });

          // LAYER LIST //
          /*const layerList = new LayerList({
           view: view,
           visibleElements: {statusIndicators: true}
           });
           view.ui.add(layerList, {position: 'top-right', index: 0});*/

          // VIEW UPDATING //
          this.disableViewUpdating = false;
          const viewUpdating = document.getElementById('view-updating');
          view.ui.add(viewUpdating, 'bottom-right');
          this._watchUtils.init(view, 'updating', updating => {
            (!this.disableViewUpdating) && viewUpdating.toggleAttribute('active', updating);
          });

          resolve();
        });
      } else { resolve(); }
    });
  }

  /**
   *
   * @param {Portal} portal
   * @param {PortalGroup} group
   * @param {EsriMap} map
   * @param {MapView|SceneView} view
   * @returns {Promise}
   */
  applicationReady({portal, group, map, view}) {
    return new Promise(async (resolve, reject) => {
      // VIEW READY //
      this.configView(view).then(() => {
        window.document.body.style.cursor = 'wait';

        this.initializeTrendCharts();
        this.initializeCountriesLayer({view});
        this.initializeNorthPole({view});
        this.initializeArcticBorealZone({view});
        this.initializeTrendLayers({view}).then(({tempMeansTrendsLayer, frozenDaysTrendLayer}) => {
          this.initializeTrendOptions({view, tempMeansTrendsLayer, frozenDaysTrendLayer});
          this.initializeAnalysisLocation({view, tempMeansTrendsLayer, frozenDaysTrendLayer});
          this.initializeIntroSlide({view}).then(() => {
            view.container.classList.remove('view-no-interaction');
            window.document.body.style.cursor = 'default';
            resolve();
          }).catch(reject);
        });

      }).catch(reject);
    });
  }

  /**
   *
   * @param view
   */
  initializeIntroSlide({view}) {
    return new Promise((resolve, reject) => {
      require(["esri/core/watchUtils"], (watchUtils) => {
        const {slides} = view.map.presentation;

        const slideButtons = slides.map(slide => {
          const slideBtn = document.createElement('calcite-button');
          slideBtn.setAttribute('appearance', 'outline');
          slideBtn.toggleAttribute('round');
          slideBtn.innerHTML = slide.title.text;

          const thumb = document.createElement('img');
          thumb.setAttribute('src', slide.thumbnail.url);
          thumb.setAttribute('scale', 's');
          slideBtn.append(thumb);

          slideBtn.addEventListener('click', () => {
            view.goTo(slide.viewpoint, {duration: 2500});
          });
          return slideBtn;
        });
        const slidesContainer = document.createElement('div');
        slidesContainer.classList.add('slides-container');
        slidesContainer.append(...slideButtons);
        view.ui.add(slidesContainer, {position: 'top-right', index: 0});

        const introSlide = slides.find(slide => slide.title.text === 'North Pole');
        if (introSlide) {
          watchUtils.whenNotOnce(view, 'updating', () => {
            view.goTo(introSlide.viewpoint, {duration: 5000}).then(resolve);
          });
        } else { resolve(); }
      });
    });
  }

  /**
   *
   * @param view
   */
  initializeNorthPole({view}) {
    require([
      "esri/Graphic",
      "esri/layers/GraphicsLayer",
      "esri/geometry/Point",
      "esri/geometry/geometryEngine"
    ], (Graphic, GraphicsLayer, Point, geometryEngine) => {

      // NORTH POLE //
      //const northPole = new Point([180.0, 90.0]);
      // NORTH POLE AREA //
      /*const northPoleAreaGraphic = new Graphic({
        geometry: geometryEngine.geodesicBuffer(northPole, 610, 'kilometers'), // 710
        symbol: {
          type: 'simple-fill',
          color: 'rgba(150,150,150,0.85)',
          outline: {color: 'rgba(67,171,235,0.1)', width: 3.2}
        }
      });*/
      const northPoleLabelGraphic = new Graphic({
        geometry: {type: 'point', x: 180.0, y: 90.0},
        symbol: {
          type: "point-3d",
          symbolLayers: [
            {
              type: "text",
              text: `north pole`,
              verticalAlignment: 'bottom',
              horizontalAlignment: 'center',
              size: 10.0,
              font: {family: 'Avenir Next LT Pro', weight: "bold"},
              material: {color: '#242424'},
              background: {color: 'rgba(255,255,255,0.2)'}
            }
          ]
        }
      });
      const northPoleLayer = new GraphicsLayer({
        //graphics: [northPoleAreaGraphic, northPoleLabelGraphic]
        graphics: [northPoleLabelGraphic]
      });

      view.map.add(northPoleLayer, 10);

    });
  }

  /**
   *
   * @param view
   */
  initializeCountriesLayer({view}) {
    const countriesLayer = view.map.allLayers.find(layer => { return (layer.title === "World Countries"); });
    countriesLayer.load().then(() => {
      countriesLayer.labelingInfo[0].labelPlacement = null;
    });
  }

  /**
   * Ocean Grids: #43abeb - #335072
   *
   * @param view
   */
  initializeArcticBorealZone({view}) {

    const transitionZoomLevel = 5.5;

    const abzGeneralizedLayer = view.map.allLayers.find(layer => { return (layer.title === "Arctic Boreal Zone - (generalized)"); });
    const abzDetailedLayer = view.map.allLayers.find(layer => { return (layer.title === "Arctic Boreal Zone - (detailed)"); });

    Promise.all([
      abzGeneralizedLayer.load(),
      abzDetailedLayer.load()
    ]).then(() => {
      view.watch('zoom', zoom => {
        //console.info(zoom);
        if (zoom < transitionZoomLevel) {
          !abzGeneralizedLayer.visible && (abzGeneralizedLayer.visible = true);
        } else {
          !abzDetailedLayer.visible && (abzDetailedLayer.visible = true);
        }
      });

    });

  }

  /**
   *
   * @param {SceneView} view
   * @returns {Promise<{tempMeansTrendsLayer: FeatureLayer, frozenDaysTrendLayer:FeatureLayer}>}
   */
  initializeTrendLayers({view}) {
    return new Promise((resolve, reject) => {

      const tempMeansTrendsLayer = view.map.allLayers.find(layer => { return (layer.title === "Temp Means Trends"); });
      const frozenDaysTrendLayer = view.map.allLayers.find(layer => { return (layer.title === "Frozen Days Trends"); });

      Promise.all([
        tempMeansTrendsLayer.load(),
        frozenDaysTrendLayer.load()
      ]).then(([]) => {

        /*const updateTrendLayerRendering = () => {

         tempMeansTrendsLayer.set({
         opacity: 0.8,
         bandId: 2,
         interpolation: 'bilinear',
         renderer: {
         type: 'raster-stretch',
         stretchType: 'min-max',
         statistics: [{
         min: -0.04,
         max: 0.04,
         avg: -0.24971247235947172,
         stddev: 0.37222849013071047
         }],
         colorRamp: {
         type: 'multipart',
         colorRamps: [
         {algorithm: 'hsv', fromColor: this.WOODWELL_COLORS.blue, toColor: this.WOODWELL_COLORS.white},
         {algorithm: 'hsv', fromColor: this.WOODWELL_COLORS.white, toColor: this.WOODWELL_COLORS.red}
         ]
         }
         }
         });

         frozenDaysTrendLayer.set({
         opacity: 0.8,
         bandId: 2,
         interpolation: 'bilinear',
         renderer: {
         type: 'raster-stretch',
         stretchType: 'min-max',
         statistics: [{
         min: -0.2,
         max: 0.2,
         avg: -0.24971247235947172,
         stddev: 0.37222849013071047
         }],
         colorRamp: {
         type: 'multipart',
         colorRamps: [
         {algorithm: 'hsv', fromColor: this.WOODWELL_COLORS.red, toColor: this.WOODWELL_COLORS.white},
         {algorithm: 'hsv', fromColor: this.WOODWELL_COLORS.white, toColor: this.WOODWELL_COLORS.blue}
         ]
         }
         }
         });
         };*/
        //updateTrendLayerRendering();

        resolve({tempMeansTrendsLayer, frozenDaysTrendLayer});
      }).catch(reject);
    });

  }

  /**
   *
   * @param {SceneView} view
   * @param {FeatureLayer} tempMeansTrendsLayer
   * @param {FeatureLayer} frozenDaysTrendLayer
   */
  initializeTrendOptions({view, tempMeansTrendsLayer, frozenDaysTrendLayer}) {

    const tempMeansBlock = document.getElementById('temp-means-block');
    const frozenDaysBlock = document.getElementById('frozen-days-block');

    const MAX_FROZEN_DAYS_DURATION = 40;

    let _duration = MAX_FROZEN_DAYS_DURATION;
    this.getDuration = () => { return _duration; };

    const setDuration = duration => {
      _duration = duration;

      tempMeansTrendsLayer.multidimensionalDefinition = [{
        variableName: 'Temperature Means Trends',
        dimensionName: 'Duration',
        values: [_duration],
        isSlice: true
      }];

      frozenDaysTrendLayer.multidimensionalDefinition = [{
        variableName: 'Frozen Days Trends',
        dimensionName: 'Duration',
        values: [_duration],
        isSlice: true
      }];

      tempMeansTrendsLayer.refresh();
      frozenDaysTrendLayer.refresh();

      this._watchUtils.whenFalseOnce(view, 'updating', () => {
        this._evented.emit('duration-change', {duration});
      });

    };
    setDuration(_duration);

    // DURATION CHANGE //
    const durationOptions = document.getElementById('duration-options');
    durationOptions.addEventListener('calciteRadioGroupChange', ({detail}) => {
      setDuration(+detail);
    });

    /**
     *
     * @param selectedLayer
     */
    const setActiveTrendLayer = selectedLayer => {
      switch (selectedLayer) {
        case 'temp-means':
          durationOptions.querySelector('calcite-radio-group-item[value="60"]').removeAttribute('disabled');
          durationOptions.querySelector('calcite-radio-group-item[value="50"]').removeAttribute('disabled');

          tempMeansTrendsLayer.visible = true;
          break;

        case 'frozen-days':
          durationOptions.querySelector('calcite-radio-group-item[value="60"]').toggleAttribute('disabled', true);
          durationOptions.querySelector('calcite-radio-group-item[value="50"]').toggleAttribute('disabled', true);

          const invalidFrozenDaysDuration = (_duration > MAX_FROZEN_DAYS_DURATION);
          invalidFrozenDaysDuration && (durationOptions.value = MAX_FROZEN_DAYS_DURATION);
          invalidFrozenDaysDuration && setDuration(MAX_FROZEN_DAYS_DURATION);

          frozenDaysTrendLayer.visible = true;
          break;
      }

      tempMeansBlock.toggleAttribute('active', (selectedLayer === 'temp-means'));
      frozenDaysBlock.toggleAttribute('active', (selectedLayer === 'frozen-days'));

    };

    // TREND LAYER VISIBILITY CHANGE //
    const tempMeansLayerToggles = document.querySelector(`.layer-toggle[layer="temp-means"]`);
    const frozenDaysLayerToggles = document.querySelector(`.layer-toggle[layer="frozen-days"]`);
    tempMeansLayerToggles.addEventListener('calciteSwitchChange', () => {
      setActiveTrendLayer(tempMeansLayerToggles.checked ? 'temp-means' : 'frozen-days');
      frozenDaysLayerToggles.checked = !tempMeansLayerToggles.checked;
    });
    frozenDaysLayerToggles.addEventListener('calciteSwitchChange', () => {
      setActiveTrendLayer(frozenDaysLayerToggles.checked ? 'frozen-days' : 'temp-means');
      tempMeansLayerToggles.checked = !frozenDaysLayerToggles.checked;
    });

  }

  /**
   *
   * @param {MapView} view
   * @param {FeatureLayer} tempMeansTrendsLayer
   * @param {FeatureLayer} frozenDaysTrendLayer
   */
  initializeAnalysisLocation({view, tempMeansTrendsLayer, frozenDaysTrendLayer}) {
    require([
      "esri/Graphic",
      'esri/layers/GraphicsLayer'
    ], (Graphic, GraphicsLayer) => {

      /*const iconSymbol = {
       type: "icon",
       size: 15.0,
       anchor: 'center',
       resource: {primitive: "kite"},
       material: {color: this.WOODWELL_COLORS.location},
       outline: {color: this.WOODWELL_COLORS.white, size: 1.5}
       };*/

      const getTextSymbol = (text) => {
        return {
          type: "text",
          text: text || 'lon: xxx.x | lat: xx.x',
          verticalAlignment: 'bottom',
          horizontalAlignment: 'center',
          size: 10.0,
          font: {family: 'Avenir Next LT Pro', weight: "600"},
          material: {color: '#242424'},
          /*halo: {color: '#424242', size: 0.4},*/
          background: {color: 'rgba(255,255,255,0.8)'}
        };
      };
      const verticalOffset = {screenLength: 33};
      const callout = {
        type: "line",
        size: 1.5,
        color: this.WOODWELL_COLORS.white
        /*border: {color: this.WOODWELL_COLORS.location, size: 3.0}*/
      };

      const getLocationSymbol = (text) => {
        return {
          type: "point-3d",
          verticalOffset, callout,
          symbolLayers: [
            //iconSymbol,
            getTextSymbol(text)
          ]
        };
      };

      const analysisLocationGraphic = new Graphic({symbol: getLocationSymbol()});
      const analysisGraphicsLayer = new GraphicsLayer({graphics: [analysisLocationGraphic]});
      view.map.add(analysisGraphicsLayer);

      const updateLocationGraphic = () => {
        const locationLabel = _mapPoint ? `lon: ${ _mapPoint.longitude.toFixed(2) } lat: ${ _mapPoint.latitude.toFixed(2) }` : null;
        analysisLocationGraphic.set({
          geometry: _mapPoint,
          symbol: getLocationSymbol(locationLabel)
        });
      };

      const analysisLocationCoordinatesInput = document.getElementById('analysis-location-coordinates-input');

      const tempMeansIndicators = document.querySelectorAll('.temp-means-indicator');
      const frozenDaysIndicators = document.querySelectorAll('.frozen-days-indicator');

      const setIndicatorTrend = (indicators, getDataResults) => {
        indicators.forEach(indicator => {
          indicator.setAttribute('trend', (getDataResults?.slope == null) ? '' : (getDataResults?.slope > 0) ? 'increase' : 'decrease');
          if (indicator.classList.contains('arrow-icon')) {
            indicator.setAttribute('icon', (getDataResults?.slope == null) ? 'line-dashed' : (getDataResults?.slope > 0) ? 'arrow-bold-up' : 'arrow-bold-down');
          }
        });
      };

      let _duration = this.getDuration();
      this._evented.on('duration-change', ({duration}) => {
        _duration = duration;
        updateLocationTrendAnalysis();
      });

      // ANALYSIS LOCATION //
      let _mapPoint = null;
      this.setAnalysisLocation = ({mapPoint}) => {
        _mapPoint = mapPoint;

        analysisLocationCoordinatesInput.value = `Longitude: ${ _mapPoint.longitude.toFixed(4) } Latitude: ${ _mapPoint.latitude.toFixed(4) }`;

        updateLocationGraphic();
        updateLocationTrendAnalysis();

        this._evented.emit('location-change', {location: _mapPoint});
      };
      this.clearAnalysisLocation = () => {
        _mapPoint = null;
        analysisLocationCoordinatesInput.value = null;
        this._evented.emit('location-change', {location: _mapPoint});
      };

      const tempMeansData = new ImageryTileData({
        layer: tempMeansTrendsLayer,
        variableName: 'Temperature Means Trends',
        dimensionName: 'Duration',
        durations: [60, 50, 40, 30, 20]
      });
      const frozenDaysData = new ImageryTileData({
        layer: frozenDaysTrendLayer,
        variableName: 'Frozen Days Trends',
        dimensionName: 'Duration',
        durations: [40, 30, 20]
      });

      // UPDATE LOCATION TREND ANALYSIS //
      const updateLocationTrendAnalysis = () => {
        if (_mapPoint) {

          tempMeansData.getData({mapPoint: _mapPoint}).then((tempMeansResults) => {
            const currentTempMeansResult = tempMeansResults.find(results => results.duration === _duration);
            setIndicatorTrend(tempMeansIndicators, currentTempMeansResult);

            this._evented.emit('temp-means-trends-change', {tempMeansTrends: tempMeansResults});
          });

          frozenDaysData.getData({mapPoint: _mapPoint}).then((frozenDaysResults) => {
            const currentFrozenDaysResult = frozenDaysResults.find(results => results.duration === _duration);
            setIndicatorTrend(frozenDaysIndicators, currentFrozenDaysResult);

            this._evented.emit('frozen-days-trends-change', {frozenDaysTrends: frozenDaysResults});
          });

        } else {
          /* ... no map point ... */
        }
      };

      // USER VIEW CLICK //
      view.on('click', this.setAnalysisLocation);

      // SAVE WEB SCENE //
      /*view.on('double-click', () => {
       view.map.updateFrom(view, {environmentExcluded: true}).then(() => {
       view.map.save({ignoreUnsupported: true});
       }).catch(error => {
       this.displayError(error);
       });
       });*/

    });
  }

  /**
   *
   */
  initializeTrendCharts() {
    require(["esri/Color"], (Color) => {

      const arcticBorealZoneTrends = this.arcticThaw.arcticBorealZoneTrends;

      Chart.defaults.font.family = 'Avenir Next LT Pro';

      const defaultTitle = {
        display: true,
        color: '#efefef',
        font: {weight: 'normal', size: 15}
      };

      const defaultLegend = {
        display: true,
        onClick: null,
        labels: {
          pointStyle: 'line',
          usePointStyle: true,
          color: '#efefef',
          filter: (item, data) => {
            console.info(item, data);
            return data.datasets.length;
          }
        }
      };

      const defaultGridLines = {
        color: '#666666',
        drawBorder: true
      };

      const defaultDataset = {
        fill: false,
        borderWidth: 1.5
      };

      const tempMeansTrendChartNode = document.getElementById('temp-means-trend-chart');
      const tempMeansChart = new Chart(tempMeansTrendChartNode, {
        type: 'line',
        data: {
          datasets: []
        },
        options: {
          animations: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              ...defaultTitle,
              text: 'Air Temperature'
            },
            legend: defaultLegend
          },
          scales: {
            y: {
              type: "linear",
              display: true,
              title: {
                display: true,
                text: 'Temperature °C',
                color: '#efefef',
                font: {size: 11}
              },
              ticks: {
                padding: 5,
                precision: 0,
                stepSize: 1,
                color: '#efefef',
                callback: function (value, index, values) { return `${ value.toFixed(1) }°`; }
              },
              grid: defaultGridLines
            },
            x: {
              type: 'linear',
              position: 'bottom',
              min: 1950,
              max: 2020,
              title: {
                display: true,
                text: 'Trend Duration',
                color: '#efefef',
                font: {size: 12}
              },
              ticks: {
                padding: 5,
                stepSize: 10,
                color: '#efefef',
                font: {size: 11},
                callback: function (value) {
                  return value.toFixed(0);
                }
              },
              grid: defaultGridLines
            }
          }
        }
      });

      const frozenDaysTrendChartNode = document.getElementById('frozen-days-trend-chart');
      const frozenDaysChart = new Chart(frozenDaysTrendChartNode, {
        type: 'line',
        data: {
          datasets: []
        },
        options: {
          animations: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              ...defaultTitle,
              text: 'Days with Frozen Ground'
            },
            legend: defaultLegend
          },
          scales: {
            y: {
              type: "linear",
              display: true,
              title: {
                display: true,
                text: 'Frozen Days',
                color: '#efefef',
                font: {size: 11}
              },
              ticks: {
                padding: 5,
                precision: 0,
                stepSize: 30,
                color: '#efefef'
              },
              grid: defaultGridLines
            },
            x: {
              type: 'linear',
              position: 'bottom',
              title: {
                display: true,
                text: 'Trend Duration',
                color: '#efefef',
                font: {size: 12}
              },
              min: 1950,
              max: 2020,
              ticks: {
                padding: 5,
                stepSize: 10,
                color: '#efefef',
                font: {size: 11},
                callback: function (value) {
                  return value.toFixed(0);
                }
              },
              grid: defaultGridLines
            }
          }
        }
      });

      const createTrendDataset = (trendInfo, duration, decreaseColor, increaseColor) => {

        const isCurrentDuration = (trendInfo.duration === duration);
        const trendColor = new Color((trendInfo.slope > 0) ? increaseColor : decreaseColor);
        trendColor.a = isCurrentDuration ? 1.0 : 0.6;
        const borderWidth = isCurrentDuration ? 2.0 : 1.0;
        const borderColor = trendColor.toCss(true);
        const pointRadius = isCurrentDuration ? 5.0 : 2.0;
        const pointBackgroundColor = isCurrentDuration ? this.WOODWELL_COLORS.white : trendColor.toCss(true);
        const pointBorderColor = trendColor.toCss(true);

        return {
          ...defaultDataset,
          borderColor,
          borderWidth,
          pointRadius,
          pointBorderColor,
          pointBackgroundColor,
          label: `${ trendInfo.duration } yrs`,
          data: [{x: trendInfo.startYear, y: trendInfo.start}, {x: trendInfo.endYear, y: trendInfo.end}]
        };

      };

      this._evented.on('temp-means-trends-change', ({tempMeansTrends}) => {
        let duration = this.getDuration();
        if (tempMeansTrends) {
          //tempMeansChart.options.plugins.title.text = `Air Temperature - ${ duration } years`;
          tempMeansChart.data.datasets = tempMeansTrends.filter(tempMeansTrend => {
            return (tempMeansTrend.slope != null);
          }).map(tempMeansTrend => {
            return createTrendDataset(tempMeansTrend, duration, this.WOODWELL_COLORS.blue, this.WOODWELL_COLORS.red);
          });
          tempMeansChart.update();
        } else {
          //tempMeansChart.options.plugins.title.text = `Air Temperature`;
          tempMeansChart.data.datasets = [];
          tempMeansChart.update();
        }
      });

      this._evented.on('frozen-days-trends-change', ({frozenDaysTrends}) => {
        let duration = this.getDuration();
        if (frozenDaysTrends) {
          //frozenDaysChart.options.plugins.title.text = `Days with Frozen Ground - ${ duration } years`;
          frozenDaysChart.data.datasets = frozenDaysTrends.filter(frozenDaysTrend => {
            return (frozenDaysTrend.slope != null);
          }).map(frozenDaysTrend => {
            return createTrendDataset(frozenDaysTrend, duration, this.WOODWELL_COLORS.red, this.WOODWELL_COLORS.blue);
          });
          frozenDaysChart.update();
        } else {
          //frozenDaysChart.options.plugins.title.text = `Days with Frozen Ground`;
          frozenDaysChart.data.datasets = [];
          frozenDaysChart.update();
        }
      });

    });
  }

}

export default new Application();
