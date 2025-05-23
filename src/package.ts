/* Do not change these import lines to match external modules in webpack configuration */
import * as grok from 'datagrok-api/grok';
import * as ui from 'datagrok-api/ui';
import * as DG from 'datagrok-api/dg';
import { getSpectrumViewerComponent } from './spectra-editor-wrapper'

export const _package = new DG.Package();

//name: info
export function info() {
  grok.shell.info(_package.webRoot);
}

async function readJDXFile(fileContent: string, fileName: string): Promise<DG.View> {
  const root = ui.div([], { classes: 'd4-spectrum' });
  const spectrumComponent = getSpectrumViewerComponent(root, fileContent);
  const spectrumHtmlView = DG.View.fromRoot(spectrumComponent.host);
  spectrumHtmlView.name = fileName;
  spectrumComponent.loadData(fileContent);

  spectrumHtmlView.subs.push(grok.events.onCurrentViewChanged.subscribe(() => {
    const cv = grok.shell.v;
    if ('id' in cv && cv.id && spectrumHtmlView.id && cv.id === spectrumHtmlView.id) {
      spectrumComponent.loadData(fileContent);
      spectrumHtmlView.root.appendChild(spectrumComponent.host);
    }
  }))
  return spectrumHtmlView;
}


//name: spectraDataCheck
//input: string fileData
//output: bool res
export async function spectraDataCheck(fileData: string) {
  return !fileData.includes('NMR SPECTRUM');
}

//name: previewSpectraData
//tags: fileViewer
//meta.fileViewer: jdx
//meta.fileViewerCheck: SpectraViewer:spectraDataCheck
//input: file file
//output: view v
export async function previewSpectraData(fileData: DG.FileInfo): Promise<DG.View> {
  return await readJDXFile(await fileData.readAsString(), fileData.name);
}

//name: importSpectraData
//tags: file-handler
//meta.ext: jdx
//meta.fileViewerCheck: SpectraViewer:spectraDataCheck
//input: string fileString
//output: list v
export async function importSpectraData(fileString: string) {
  const res = await readJDXFile(fileString, 'Spectra');
  const newView = grok.shell.addView(res);
  newView != res && res.subs.forEach((s) => newView.subs.push(s));
  return [];
}