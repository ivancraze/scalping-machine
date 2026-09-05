import {
  LineStyle,
  type Coordinate,
  type IChartApiBase,
  type IHorzScaleBehavior,
  type ISeriesApi,
  type SeriesType,
} from 'lightweight-charts';
import {
  AnchorPoint,
  BaseLineTool,
  BoxHorizontalAlignment,
  BoxVerticalAlignment,
  type CompositeRenderer,
  type DeepPartial,
  HitTestType,
  type IPaneRenderer,
  LineAnchorRenderer,
  LineCap,
  LineEnd,
  LineJoin,
  LineToolPaneView,
  type LineToolOptionsInternal,
  type LineToolPoint,
  type LineToolType,
  type LineToolsCorePlugin,
  OffScreenState,
  PaneCursorType,
  type PriceAxisLabelStackingManager,
  type PriceRangeToolOptions,
  SegmentRenderer,
  TextAlignment,
  TextRenderer,
  deepCopy,
  getToolCullingState,
  merge,
} from 'lightweight-charts-line-tools-core';
import { formatRulerLabel } from '../lib/ruler-format';

declare module 'lightweight-charts-line-tools-core' {
  interface LineToolOptionsMap {
    Ruler: PriceRangeToolOptions;
  }
}

const UP_COLOR = '#0ac18b';
const DOWN_COLOR = '#e63c64';
const UP_BACKGROUND = 'rgba(10, 193, 139, 0.16)';
const DOWN_BACKGROUND = 'rgba(230, 60, 100, 0.16)';

const RulerOptionsDefaults: LineToolOptionsInternal<'Ruler'> = {
  visible: true,
  editable: true,
  defaultHoverCursor: PaneCursorType.Pointer,
  defaultDragCursor: PaneCursorType.Grabbing,
  defaultAnchorHoverCursor: PaneCursorType.Pointer,
  defaultAnchorDragCursor: PaneCursorType.Grabbing,
  showPriceAxisLabels: true,
  showTimeAxisLabels: true,
  priceAxisLabelAlwaysVisible: false,
  timeAxisLabelAlwaysVisible: false,
  text: {
    value: '',
    alignment: TextAlignment.Center,
    font: {
      color: '#ffffff',
      size: 12,
      bold: true,
      italic: false,
      family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    box: {
      alignment: {
        vertical: BoxVerticalAlignment.Top,
        horizontal: BoxHorizontalAlignment.Center,
      },
      angle: 0,
      scale: 1,
      offset: { x: 0, y: -8 },
      padding: { x: 8, y: 5 },
      border: {
        color: UP_COLOR,
        width: 1,
        radius: 4,
        highlight: false,
        style: LineStyle.Solid,
      },
      background: { color: UP_COLOR, inflation: { x: 0, y: 0 } },
    },
    padding: 0,
    wordWrapWidth: 0,
    forceTextAlign: false,
    forceCalculateMaxLineWidth: false,
  },
  priceRange: {
    rectangle: {
      extend: { left: false, right: false },
      background: { color: UP_BACKGROUND },
      border: { width: 1, style: LineStyle.Solid, color: UP_COLOR, radius: 0 },
    },
    verticalLine: {
      width: 1,
      color: UP_COLOR,
      style: LineStyle.Solid,
      join: LineJoin.Miter,
      cap: LineCap.Butt,
      end: { left: LineEnd.Normal, right: LineEnd.Arrow },
      extend: { left: false, right: false },
    },
    horizontalLine: {
      width: 1,
      color: UP_COLOR,
      style: LineStyle.Solid,
      join: LineJoin.Miter,
      cap: LineCap.Butt,
      end: { left: LineEnd.Normal, right: LineEnd.Arrow },
      extend: { left: false, right: false },
    },
    showCenterHorizontalLine: true,
    showCenterVerticalLine: true,
    showTopPrice: true,
    showBottomPrice: true,
  },
};

class LineToolRulerPaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {
  private readonly horizontalRenderer = new SegmentRenderer<HorzScaleItem>();
  private readonly verticalRenderer = new SegmentRenderer<HorzScaleItem>();
  private readonly diagonalRenderer = new SegmentRenderer<HorzScaleItem>();
  private readonly horizontalArrowRenderers = [
    new SegmentRenderer<HorzScaleItem>(),
    new SegmentRenderer<HorzScaleItem>(),
  ] as const;
  private readonly verticalArrowRenderers = [
    new SegmentRenderer<HorzScaleItem>(),
    new SegmentRenderer<HorzScaleItem>(),
  ] as const;
  private readonly measurementLabelRenderer = new TextRenderer<HorzScaleItem>();

  protected override _updateImpl() {
    this._invalidated = false;
    this._renderer.clear();
    const tool = this._tool as LineToolRuler<HorzScaleItem>;
    const options = tool.options() as LineToolOptionsInternal<'Ruler'>;
    if (!options.visible || tool.isCulled() || !this._updatePoints() || this._points.length < 2) return;

    const [start, end] = this._points;
    const [startPoint, endPoint] = tool.points();
    if (!start || !end || !startPoint || !endPoint) return;

    const isUpward = endPoint.price >= startPoint.price;
    const color = isUpward ? UP_COLOR : DOWN_COLOR;
    const background = isUpward ? UP_BACKGROUND : DOWN_BACKGROUND;
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const middleX = (start.x + end.x) / 2;
    const middleY = (start.y + end.y) / 2;
    const topLeft = new AnchorPoint(minX, minY, 0);
    const bottomRight = new AnchorPoint(maxX, maxY, 1);

    this._rectangleRenderer.setData({
      points: [topLeft, bottomRight],
      background: { color: background },
      border: { color, width: 1, style: LineStyle.Solid, radius: 0 },
      hitTestBackground: true,
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor,
    });
    this._renderer.append(this._rectangleRenderer);

    const solidArrowLine = {
      color,
      width: 1,
      style: LineStyle.Solid,
      join: LineJoin.Miter,
      cap: LineCap.Butt,
      end: { left: LineEnd.Normal, right: LineEnd.Normal },
      extend: { left: false, right: false },
    };
    const horizontalStart = new AnchorPoint(start.x, middleY, 0);
    const horizontalEnd = new AnchorPoint(end.x, middleY, 1);
    this.horizontalRenderer.setData({
      points: [horizontalStart, horizontalEnd],
      line: solidArrowLine,
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor,
    });
    this._renderer.append(this.horizontalRenderer);
    this._appendSmallArrow(
      this._renderer,
      this.horizontalArrowRenderers,
      horizontalStart,
      horizontalEnd,
      color,
      options,
    );

    const verticalStart = new AnchorPoint(middleX, start.y, 0);
    const verticalEnd = new AnchorPoint(middleX, end.y, 1);
    this.verticalRenderer.setData({
      points: [verticalStart, verticalEnd],
      line: solidArrowLine,
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor,
    });
    this._renderer.append(this.verticalRenderer);
    this._appendSmallArrow(
      this._renderer,
      this.verticalArrowRenderers,
      verticalStart,
      verticalEnd,
      color,
      options,
    );

    this.diagonalRenderer.setData({
      points: [start, end],
      line: {
        ...solidArrowLine,
        style: LineStyle.Dashed,
        end: { left: LineEnd.Normal, right: LineEnd.Normal },
      },
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor,
    });
    this._renderer.append(this.diagonalRenderer);

    const labelOptions = deepCopy(options.text);
    labelOptions.value = formatRulerLabel(
      startPoint.price,
      endPoint.price,
      startPoint.timestamp,
      endPoint.timestamp,
      (price) => tool.getSeries().priceFormatter().format(price),
    );
    labelOptions.font.color = '#ffffff';
    labelOptions.font.size = 12;
    labelOptions.font.bold = true;
    labelOptions.box.alignment.horizontal = BoxHorizontalAlignment.Center;
    labelOptions.box.alignment.vertical = isUpward ? BoxVerticalAlignment.Top : BoxVerticalAlignment.Bottom;
    labelOptions.box.offset = { x: 0, y: isUpward ? -8 : 8 };
    if (labelOptions.box.background) labelOptions.box.background.color = color;
    if (labelOptions.box.border) labelOptions.box.border.color = color;
    this.measurementLabelRenderer.setData({
      points: [new AnchorPoint((minX + maxX) / 2, isUpward ? minY : maxY, 0)],
      text: labelOptions,
      hitTestBackground: true,
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor,
    });
    this._renderer.append(this.measurementLabelRenderer);

    this._addAnchors(this._renderer);
  }

  private _appendSmallArrow(
    renderer: CompositeRenderer<HorzScaleItem>,
    arrowRenderers: readonly [SegmentRenderer<HorzScaleItem>, SegmentRenderer<HorzScaleItem>],
    tail: AnchorPoint,
    tip: AnchorPoint,
    color: string,
    options: LineToolOptionsInternal<'Ruler'>,
  ) {
    const deltaX = tip.x - tail.x;
    const deltaY = tip.y - tail.y;
    const length = Math.hypot(deltaX, deltaY);
    if (length < 1) return;

    const unitX = deltaX / length;
    const unitY = deltaY / length;
    const arrowLength = Math.min(5, length / 4);
    const arrowSpread = arrowLength * 0.55;
    const baseX = tip.x - unitX * arrowLength;
    const baseY = tip.y - unitY * arrowLength;
    const perpendicularX = -unitY * arrowSpread;
    const perpendicularY = unitX * arrowSpread;
    const line = {
      color,
      width: 1,
      style: LineStyle.Solid,
      join: LineJoin.Miter,
      cap: LineCap.Butt,
      end: { left: LineEnd.Normal, right: LineEnd.Normal },
      extend: { left: false, right: false },
    };
    const wingPoints = [
      new AnchorPoint(baseX + perpendicularX, baseY + perpendicularY, 0),
      new AnchorPoint(baseX - perpendicularX, baseY - perpendicularY, 0),
    ];

    arrowRenderers.forEach((arrowRenderer, index) => {
      arrowRenderer.setData({
        points: [wingPoints[index], tip],
        line,
        toolDefaultHoverCursor: options.defaultHoverCursor,
        toolDefaultDragCursor: options.defaultDragCursor,
      });
      renderer.append(arrowRenderer);
    });
  }

  protected override _addAnchors(renderer: CompositeRenderer<HorzScaleItem>) {
    if (this._points.length < 2) return;
    const [start, end] = this._points;
    if (!start || !end) return;
    const tool = this._tool as LineToolRuler<HorzScaleItem>;
    const [startPoint, endPoint] = tool.points();
    if (!startPoint || !endPoint) return;

    const color = endPoint.price >= startPoint.price ? UP_COLOR : DOWN_COLOR;
    const diagonalCursor =
      Math.sign((start.x - end.x) * (start.y - end.y)) < 0
        ? PaneCursorType.DiagonalNeSwResize
        : PaneCursorType.DiagonalNwSeResize;
    const anchorPoints = [
      new AnchorPoint(start.x, start.y, 0, false, diagonalCursor),
      new AnchorPoint(end.x, end.y, 1, false, diagonalCursor),
    ];
    let anchorRenderer = this._lineAnchorRenderers[0];
    if (!anchorRenderer) {
      anchorRenderer = new LineAnchorRenderer(this._chart);
      this._lineAnchorRenderers.push(anchorRenderer);
    }
    const toolOptions = tool.options();
    anchorRenderer.setData({
      points: anchorPoints,
      backgroundColors: [color, color],
      editedPointIndex: tool.isEditing() ? tool.editedPointIndex() : null,
      currentPoint: tool.currentPoint(),
      color,
      radius: 5,
      strokeWidth: 1,
      hoveredStrokeWidth: 4,
      selected: tool.isSelected(),
      visible: this.areAnchorsVisible(),
      hitTestType: HitTestType.ChangePoint,
      defaultAnchorHoverCursor: toolOptions.defaultAnchorHoverCursor,
      defaultAnchorDragCursor: toolOptions.defaultAnchorDragCursor,
    });
    renderer.append(anchorRenderer);
  }
}

export class LineToolRuler<HorzScaleItem> extends BaseLineTool<HorzScaleItem> {
  readonly toolType: LineToolType = 'Ruler';
  readonly pointsCount = 2;

  constructor(
    coreApi: LineToolsCorePlugin<HorzScaleItem>,
    chart: IChartApiBase<HorzScaleItem>,
    series: ISeriesApi<SeriesType, HorzScaleItem>,
    horzScaleBehavior: IHorzScaleBehavior<HorzScaleItem>,
    options: DeepPartial<LineToolOptionsInternal<'Ruler'>> = {},
    points: LineToolPoint[] = [],
    priceAxisLabelStackingManager: PriceAxisLabelStackingManager<HorzScaleItem>,
  ) {
    const finalOptions = deepCopy(RulerOptionsDefaults);
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      'Ruler',
      2,
      priceAxisLabelStackingManager,
    );
    this._setPaneViews([new LineToolRulerPaneView(this, this._chart, this._series)]);
  }

  supportsClickClickCreation() {
    return true;
  }

  supportsClickDragCreation() {
    return true;
  }

  normalize() {
    // The first and second points retain their meaning so direction remains stable.
  }

  _internalHitTest(x: Coordinate, y: Coordinate) {
    // The core declares pane renderers without hitTest even though line-tool views return it.
    const renderer = this.paneViews()[0]?.renderer() as IPaneRenderer | null | undefined;
    return renderer?.hitTest?.(x, y) ?? null;
  }

  protected override updateCullingState() {
    const points = this.points();
    if (points.length < this.pointsCount || this.isCreating() || this.isEditing()) {
      this._setIsCulled(false);
      return;
    }
    const cullingState = getToolCullingState(
      points,
      this,
      { left: false, right: false },
      undefined,
      undefined,
      true,
    );
    this._setIsCulled(cullingState !== OffScreenState.Visible);
  }
}
