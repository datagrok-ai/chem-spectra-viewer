import { HashRouter as Router, Route, Routes } from "react-router-dom";
import * as DG from "datagrok-api/dg";
import React from "react";
import * as ReactDOM from "react-dom/client";
import * as jcampconverter from 'jcampconverter';
import * as commonSpectrum from 'common-spectrum';

//@ts-ignore
import { SpectraEditor, FN } from "@complat/react-spectra-editor";

class SpectrumViewer extends React.Component<{ data: string, loadDataObj: {loadData: (d: string) => void} }> {
  data: any;
  constructor(props) {
    super(props);

    this.data = FN.ExtractJcamp(props.data);

    props.loadDataObj.loadData = (d: string) => {
      this.data = FN.ExtractJcamp(d);
      this.setState({...this.state, data: this.data});
    }

    // this.onClick = this.onClick.bind(this);
    this.writeMpy = this.writeMpy.bind(this);
    this.writePeak = this.writePeak.bind(this);
    this.formatPks = this.formatPks.bind(this);
    this.formatMpy = this.formatMpy.bind(this);
    this.savePeaks = this.savePeaks.bind(this);
    this.predictOp = this.predictOp.bind(this);
    this.updatInput = this.updatInput.bind(this);
    this.loadEntity = this.loadEntity.bind(this);
    this.onShowOthers = this.onShowOthers.bind(this);
    this.onDescriptionChanged = this.onDescriptionChanged.bind(this);
    this.loadMultiEntities = this.loadMultiEntities.bind(this);
  }

  onClick(typ) {
    return () => {
      // this.setState({
      //   typ,
      //   desc: "",
      //   predictions: false,
      //   molecule: "",
      // });
    };
  }

  onShowOthers(jcamp) {
    // eslint-disable-line
    // this.setState({ showOthers: true });
  }

  onDescriptionChanged(content) {
    // console.log(content)
    // this.setState({ descChanged: content });
  }

  loadEntity() {
    return this.data as
      | {
          spectra: any;
          features: {};
          layout: any;
          temperature: any;
        }
      | {
          spectra: any;
          features: {};
          layout: any;
          temperature?: undefined;
        };
  }

  loadMultiEntities() {
    return false;
  }

  rmDollarSign(target) {
    return target.replace(/\$/g, "");
  }

  formatPks({
    peaks,
    layout,
    shift,
    isAscend,
    decimal,
    isIntensity,
    integration,
    waveLength,
    cyclicvoltaSt,
    curveSt,
  }) {
    const entity = this.loadEntity();
    const { features } = entity;
    const { temperature } = entity;
    const { maxY, minY } = Array.isArray(features)
      ? {}
      : (features as any).editPeak || (features as any).autoPeak;
    const boundary = { maxY, minY };
    const body = FN.peaksBody({
      peaks,
      layout,
      decimal,
      shift,
      isAscend,
      isIntensity,
      boundary,
      integration,
      waveLength,
      temperature,
    });
    const wrapper = FN.peaksWrapper(layout, shift);
    let desc = this.rmDollarSign(wrapper.head) + body + wrapper.tail;

    if (FN.isCyclicVoltaLayout(layout)) {
      const { spectraList } = cyclicvoltaSt;
      const { curveIdx, listCurves } = curveSt;
      const selectedVolta = spectraList[curveIdx];
      const selectedCurve = listCurves[curveIdx];
      const { feature } = selectedCurve;
      const { scanRate } = feature;
      const data = {
        scanRate,
        voltaData: {
          listPeaks: selectedVolta.list,
          xyData: feature.data[0],
        },
      };
      const inlineData = FN.inlineNotation(layout, data);
      const { formattedString } = inlineData;
      desc = formattedString;
    }
    return desc;
  }

  formatMpy({ multiplicity, integration, shift, isAscend, decimal, layout }) {
    // obsv freq
    const entity = this.loadEntity();
    const { features } = entity;
    const { observeFrequency } = Array.isArray(features)
      ? features[0]
      : (features as any).editPeak || (features as any).autoPeak;
    const freq = observeFrequency[0];
    const freqStr = freq ? `${parseInt(freq, 10)} MHz, ` : "";
    // multiplicity
    const { refArea, refFactor } = integration;
    const shiftVal = multiplicity.shift;
    const ms = multiplicity.stack;
    const is = integration.stack;

    const macs = ms
      .map((m) => {
        const { peaks, mpyType, xExtent } = m;
        const { xL, xU } = xExtent;
        const it = is.filter((i) => i.xL === xL && i.xU === xU)[0] || {
          area: 0,
        };
        const area = (it.area * refFactor) / refArea; // eslint-disable-line
        const center = FN.calcMpyCenter(peaks, shiftVal, mpyType);
        const xs = m.peaks.map((p) => p.x).sort((a, b) => a - b);
        const [aIdx, bIdx] = isAscend ? [0, xs.length - 1] : [xs.length - 1, 0];
        const mxA =
          mpyType === "m" ? (xs[aIdx] - shiftVal).toFixed(decimal) : 0;
        const mxB =
          mpyType === "m" ? (xs[bIdx] - shiftVal).toFixed(decimal) : 0;
        return Object.assign({}, m, {
          area,
          center,
          mxA,
          mxB,
        });
      })
      .sort((a, b) => (isAscend ? a.center - b.center : b.center - a.center));
    const str = macs
      .map((m) => {
        const c = m.center;
        const type = m.mpyType;
        const it = Math.round(m.area);
        const js = m.js.map((j) => `J = ${j.toFixed(1)} Hz`).join(", ");
        const atomCount = layout === "1H" ? `, ${it}H` : "";
        const location =
          type === "m" ? `${m.mxA}–${m.mxB}` : `${c.toFixed(decimal)}`;
        return m.js.length === 0
          ? `${location} (${type}${atomCount})`
          : `${location} (${type}, ${js}${atomCount})`;
      })
      .join(", ");
    const { label, value, name } = shift.ref;
    const solvent = label
      ? `${name.split("(")[0].trim()} [${value.toFixed(decimal)} ppm], `
      : "";
    return `${layout} NMR (${freqStr}${solvent}ppm) δ = ${str}.`;
  }

  writeMpy({ layout, shift, isAscend, decimal, multiplicity, integration }) {
    if (!FN.isNmrLayout(layout)) return;
    const desc = this.formatMpy({
      multiplicity,
      integration,
      shift,
      isAscend,
      decimal,
      layout,
    });
    // this.setState({ desc });
  }

  writePeak({
    peaks,
    layout,
    shift,
    isAscend,
    decimal,
    isIntensity,
    integration,
    waveLength,
    cyclicvoltaSt,
    curveSt,
  }) {
    const desc = this.formatPks({
      peaks,
      layout,
      shift,
      isAscend,
      decimal,
      isIntensity,
      integration,
      waveLength, // eslint-disable-line
      cyclicvoltaSt,
      curveSt, // eslint-disable-line
    });
    // this.setState({ desc });
  }

  savePeaks({
    peaks,
    layout,
    shift,
    isAscend,
    decimal,
    analysis,
    isIntensity,
    integration,
    multiplicity,
    waveLength,
  }) {
    const entity = this.loadEntity();
    const { features } = entity;
    const { temperature } = entity;
    const { maxY, minY } = Array.isArray(features)
      ? features[0]
      : (features as any).editPeak || (features as any).autoPeak;
    const boundary = { maxY, minY };
    const body = FN.peaksBody({
      peaks,
      layout,
      decimal,
      shift,
      isAscend,
      isIntensity,
      boundary,
      waveLength,
      temperature,
    });
    /*eslint-disable */
    if (shift?.ref?.label) {
      const label = this.rmDollarSign(shift.ref.label);
      alert(
        `Peaks: ${body}` +
          "\n" +
          "- - - - - - - - - - -" +
          "\n" +
          `Shift solvent = ${label}, ${shift.ref.value}ppm` +
          "\n"
      );
    } else {
      DG.Utils.download('Peaks.txt', body);
      //alert(`Peaks: ${body}` + "\n");
    }
    /*eslint-disable */
  }

  predictOp({ multiplicity, curveSt }) {
    const { curveIdx } = curveSt;
    const { multiplicities } = multiplicity;
    const selectedMultiplicity = multiplicities[curveIdx];
    const { stack, shift } = selectedMultiplicity;
    const targets = stack.map((stk) => {
      const { mpyType, peaks } = stk;
      return FN.CalcMpyCenter(peaks, shift, mpyType);
    });
    // console.log(targets)
    const { molecule, typ } = this.data as any;
    const predictions = { running: true };

    // this.setState({ predictions });
    // // simulate fetching...
    // const result = typ === 'ir' ? irResult : nmrResult;
    // setTimeout(() => {
    //   this.setState({ predictions: result });
    // }, 2000);
  }

  updatInput(e) {
    const molecule = e.target.value;
    // this.setState({ molecule });
  }

  render() {
    const { desc, predictions, molecule, typ } = this.data as any;
    const entity = this.loadEntity();

    let operations = [
      { name: "write peaks", value: this.writePeak },
      { name: "save", value: this.savePeaks },
    ].filter((r) => r.value);
    // if (FN.isNmrLayout(entity.layout)) {
    //   operations = [
    //     { name: "write multiplicity", value: this.writeMpy },
    //     ...operations,
    //   ];
    // }

    const refreshCb = () => alert("Refresch simulation!");

    const forecast = {
      btnCb: this.predictOp,
      refreshCb,
      inputCb: this.updatInput,
      molecule: molecule,
      predictions,
    };

    const molSvg = "";
    const others = {
      others: [],
      addOthersCb: this.onShowOthers,
    }; 

    return (
      <div style={{ width: '100%' }}>
        <SpectraEditor
          {...SpectraEditor.defaultProps}
          entity={entity}
          // others={others}
          editorOnly={false}
          canChangeDescription={true}
          onDescriptionChanged={() => {}}
          molSvg={molSvg}
          // exactMass={"123.0"}
          userManualLink={{
            cv: "https://www.chemotion.net/chemotionsaurus/docs/eln/chemspectra/cvanalysis",
          }}
          //forecast={forecast}
          operations={operations}
        />
      </div>
      
    );
  }
}


export function getSpectrumViewer(props: { data: string, loadDataObj: {loadData: (d: string) => void} }) { 
//   let parsed = jcampconverter.convert(props.data);

//   let dataUpdated = '';
// //   if(parsed.entries[0].dataType === 'MASS SPECTRUM')
// //   {
// //     dataUpdated  = `
// // $$ === CHEMSPECTRA SPECTRUM ORIG ===
// // ${props.data}
// // ##END=`
// //   }
// //   else 
//   dataUpdated  = `
// ##TITLE=${parsed.entries[0].title}
// ##JCAMP-DX=5.0
// ##DATA TYPE=LINK
// ##BLOCKS=1

// $$ === CHEMSPECTRA SPECTRUM ORIG ===
// ${props.data}

// $$ === CHEMSPECTRA PEAK TABLE EDIT ===
// ##TITLE=${parsed.entries[0].title}
// ##JCAMP-DX=5.00
// ##DATA TYPE=INFRAREDPEAKTABLE
// ##DATA CLASS=PEAKTABLE
// ##$CSTHRESHOLD=0.93
// ##MAXX=3966.0
// ##MAXY=1.56284
// ##MINX=450.0
// ##MINY=0.0
// ##$CSSOLVENTNAME=- - -
// ##$CSSOLVENTVALUE=0
// ##$CSSOLVENTX=0
// ##NPOINTS=10
// ##PEAKTABLE= (XY..XY)
// 3965.050 100137504 100078272 100069616 100096072 100104992 100132712
// 3976.621 100135296 100146800 100087440 100043504 100075744 100117744
// 3988.192 100102344 100058920 100038256 100067752 100044456 100078136
// 3999.762 100083936
// ##END=

// $$ === CHEMSPECTRA PEAK TABLE AUTO ===
// ##TITLE=${parsed.entries[0].title}
// ##JCAMP-DX=5.00
// ##DATA TYPE=INFRAREDPEAKTABLE
// ##DATA CLASS=PEAKTABLE
// ##$CSTHRESHOLD=0.93
// ##MAXX=3966.0
// ##MAXY=1.56284
// ##MINX=450.0
// ##MINY=0.0
// ##NPOINTS=10
// ##PEAKTABLE= (XY..XY)
// 3965.050 100137504 100078272 100069616 100096072 100104992 100132712
// 3976.621 100135296 100146800 100087440 100043504 100075744 100117744
// 3988.192 100102344 100058920 100038256 100067752 100044456 100078136
// 3999.762 100083936
// ##END=

// ##END=`;

  return <SpectrumViewer data={props.data} loadDataObj={props.loadDataObj}/>;
}

let component: {host: HTMLElement, loadData: (d: string) => void} | null = null;

export function getSpectrumViewerComponent(host: HTMLElement, data: string) {
  if (component)
    return component;
  const loadDataObj = {loadData: (d: string) => {}};
  const props = { data: data, loadDataObj: loadDataObj };
  const rElement = React.createElement(getSpectrumViewer, props, null);
  const root = ReactDOM.createRoot(host);
  root.render(rElement);
  component = {host: host, loadData: (d: string) => loadDataObj.loadData(d)};
  return component;
}
