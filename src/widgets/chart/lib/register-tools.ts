import { LineToolCircle } from 'lightweight-charts-line-tools-circle';
import { type ILineToolsPlugin } from 'lightweight-charts-line-tools-core';
import { registerFibRetracementPlugin } from 'lightweight-charts-line-tools-fib-retracement';
import { registerFreehandPlugin } from 'lightweight-charts-line-tools-freehand';
import { registerLinesPlugin } from 'lightweight-charts-line-tools-lines';
import { registerLongShortPositionPlugin } from 'lightweight-charts-line-tools-long-short-position';
import { registerMarketDepthPlugin } from 'lightweight-charts-line-tools-market-depth';
import { registerParallelChannelPlugin } from 'lightweight-charts-line-tools-parallel-channel';
import { registerPathPlugin } from 'lightweight-charts-line-tools-path';
import { registerPriceRangePlugin } from 'lightweight-charts-line-tools-price-range';
import { LineToolRectangle } from 'lightweight-charts-line-tools-rectangle';
import { registerTextPlugin } from 'lightweight-charts-line-tools-text';
import { registerTrianglePlugin } from 'lightweight-charts-line-tools-triangle';
type PluginWithLooseRegistration = ILineToolsPlugin & {
  registerLineTool: (type: string, toolClass: new (...args: never[]) => unknown) => void;
};

export const registerTools = (plugin: ILineToolsPlugin) => {
  // Isolate the existing line-tools constructor type compatibility adapter.
  const lineTools = plugin as PluginWithLooseRegistration;
  registerLinesPlugin(lineTools);
  registerFreehandPlugin(lineTools);
  lineTools.registerLineTool('Rectangle', LineToolRectangle);
  lineTools.registerLineTool('Circle', LineToolCircle);
  registerTrianglePlugin(lineTools);
  registerPathPlugin(lineTools);
  registerParallelChannelPlugin(lineTools);
  registerFibRetracementPlugin(lineTools);
  registerPriceRangePlugin(lineTools);
  registerLongShortPositionPlugin(lineTools);
  registerTextPlugin(lineTools);
  registerMarketDepthPlugin(lineTools);
};
