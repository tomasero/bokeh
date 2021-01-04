import {TickFormatter, TickFormatterView} from "./tick_formatter"
import {BasicTickFormatter, BasicTickFormatterView} from "./basic_tick_formatter"
import {LogTicker} from "../tickers/log_ticker"
import type {LogAxisView} from "../axes/log_axis"
import {build_view} from "core/build_views"
import * as p from "core/properties"

export class LogTickFormatterView extends TickFormatterView {
  model: LogTickFormatter
  parent: LogAxisView

  protected basic_formatter: BasicTickFormatter
  protected basic_formatter_view: BasicTickFormatterView

  initialize(): void {
    super.initialize()
    this.basic_formatter = new BasicTickFormatter()
  }

  async lazy_initialize(): Promise<void> {
    await super.lazy_initialize()
    this.basic_formatter_view = await build_view(this.basic_formatter, {parent: this.parent})
  }

  format(ticks: number[]): string[] {
    if (ticks.length == 0)
      return []

    const {base} = this.parent.model.ticker

    let small_interval = false
    const labels: string[] = new Array(ticks.length)
    for (let i = 0, end = ticks.length; i < end; i++) {
      labels[i] = `${base}^${ Math.round(Math.log(ticks[i]) / Math.log(base)) }`
      if (i > 0 && labels[i] == labels[i-1]) {
        small_interval = true
        break
      }
    }

    if (small_interval)
      return this.basic_formatter_view.format(ticks)
    else
      return labels
  }
}

export namespace LogTickFormatter {
  export type Attrs = p.AttrsOf<Props>

  export type Props = TickFormatter.Props & {
    /** @deprecated */
    ticker: p.Property<LogTicker | null>
  }
}

export interface LogTickFormatter extends LogTickFormatter.Attrs {}

export class LogTickFormatter extends TickFormatter {
  properties: LogTickFormatter.Props
  __view_type__: LogTickFormatterView

  constructor(attrs?: Partial<LogTickFormatter.Attrs>) {
    super(attrs)
  }

  static init_LogTickFormatter(): void {
    this.prototype.default_view = LogTickFormatterView

    this.define<LogTickFormatter.Props>(({Ref, Nullable}) => ({
      /** @deprecated */
      ticker: [ Nullable(Ref(LogTicker)), null ],
    }))
  }
}
