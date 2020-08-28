import * as p from "core/properties"

import {div, input} from "core/dom"
import {Signalable} from "core/signaling"
import {Color} from "core/types"
import {InputWidget, InputWidgetView} from "models/widgets/input_widget"
import {Widget} from "models/widgets/widget"

import {bk_input} from "styles/widgets/inputs"

function isDescendant(parent: HTMLElement, child: Element | null): boolean {
  if (child == null)
    return false
  else {
    let node = child.parentNode
    while (node != null) {
      if (node == parent)
        return true
      node = node.parentNode
    }
    return false
  }
}

export class ColorPickerView extends InputWidgetView {
  model: ColorPicker

  protected color_picker_container_el: HTMLDivElement
  protected gradient_panel_view: GradientPanelView
  protected hue_slider_view: HueSliderView

  private _color_updating: boolean
  private _dragging: boolean

  initialize(): void {
    super.initialize()
    this._color_updating = false
    this._dragging = false

    const {hue: h, saturation: s, lightness: l} = hex_to_hsl(this.model.color)
    this.gradient_panel_view = new GradientPanelView(h,s,l)
    this.hue_slider_view = new HueSliderView(h)

    this.connect_signals()

    //event listeners
    this.el.addEventListener("mousedown", () => this._dragging = true, true)
    document.addEventListener("mouseup", () => {
      if(this._dragging && this.model.color_throttled != this.model.color){
        this.model.color_throttled = this.model.color
        this._dragging = false
      }
    }, true)
  }

  connect_signals(): void {
    super.connect_signals()
    const {name, color, disabled} = this.model.properties
    const {hue} = this.hue_slider_view.model.properties
    const {lightness, saturation} = this.gradient_panel_view.model.properties

    this.on_change(hue, () => {
      this.gradient_panel_view.model.hue = this.hue_slider_view.model.hue
    })
    this.on_change([lightness, saturation, hue], () => {
      const {hue} = this.hue_slider_view.model
      const {saturation, lightness} = this.gradient_panel_view.model
      if (!this._color_updating)
        this.model.color = hsl_to_hex({hue: hue, saturation: saturation, lightness: lightness})
    })
    this.on_change(color, () => {
      this._color_updating = true
      const hsl = hex_to_hsl(this.model.color)
      if (!this._dragging) {
        this.gradient_panel_view.model.setv({saturation: hsl.saturation, lightness: hsl.lightness}, {silent: true})
        this.hue_slider_view.model.setv({hue: hsl.hue})
        this.model.color_throttled = this.model.color
      }
      this._update_input_color()
      this._color_updating = false
    })
    this.on_change(name, () => this.input_el.name = this.model.name ?? "")
    this.on_change(disabled, () => this.input_el.disabled = this.model.disabled)
  }

  render(): void {
    super.render()
    this.input_el = input({
      type: "button",
      class: [bk_input, "bk-color-picker-input"],
      name: this.model.name,
    })
    this.group_el.appendChild(this.input_el)

    this.color_picker_container_el = div({
      class: "bk-color-picker-ctn",
    })
    this.color_picker_container_el.appendChild(this.gradient_panel_view.gradient_panel_el)
    this.color_picker_container_el.appendChild(this.hue_slider_view.hue_slider_el)
    this.color_picker_container_el.style.visibility = "collapse"
    this.color_picker_container_el.style.display = "none"
    this.el.appendChild(this.color_picker_container_el)
    this._update_input_color()

    this.input_el.addEventListener("click", () => this._show_picker())
    document.addEventListener("mousedown", (ev) => this._hide_picker(ev))
  }

  get hsl(): HSL {
    const {hue} = this.hue_slider_view.model
    const {saturation, lightness} = this.gradient_panel_view.model
    return {hue: hue, saturation: saturation, lightness: lightness}
  }

  _update_input_color(): void {
    this.input_el.style.backgroundColor = this.model.color
  }

  _hide_picker(ev: MouseEvent): void {
    if (this.color_picker_container_el.style.visibility == "visible" && !isDescendant(this.color_picker_container_el, <Element>ev.target)) {
      this.color_picker_container_el.style.visibility = "collapse"
      this.color_picker_container_el.style.display = "none"
    }
  }

  _show_picker(): void {
    this.color_picker_container_el.style.visibility = "visible"
    this.color_picker_container_el.style.display = "flex"
    const {hue: h, saturation: s, lightness: l} = this.hsl
    this.gradient_panel_view._set_cursor_pos_x(this.gradient_panel_view._sat_to_pos_x(s))
    this.gradient_panel_view._set_cursor_pos_y(this.gradient_panel_view._light_to_pos_y(l))
    this.hue_slider_view._set_cursor_pos(this.hue_slider_view._hue_to_pos(h))
  }
}

export namespace ColorPicker {
  export type Attrs = p.AttrsOf<Props>

  export type Props = InputWidget.Props & {
    color: p.Property<Color>
    color_throttled: p.Property<Color>
  }
}

export interface ColorPicker extends ColorPicker.Attrs {}

export class ColorPicker extends InputWidget {
  properties: ColorPicker.Props
  __view_type__: ColorPickerView

  constructor(attrs?: Partial<Widget.Attrs>) {
    super(attrs)
  }

  static init_ColorPicker(): void {
    this.prototype.default_view = ColorPickerView

    this.define<ColorPicker.Props>({
      color:            [p.Color, "#000000"],
      color_throttled:  [p.Color]
    })
  }
}

class GradientPanelView extends Signalable() {
  gradient_panel_el: HTMLDivElement
  cursor_el: HTMLDivElement
  model: GradientPanel

  constructor(hue: number, saturation: number, lightness: number) {
    super()
    this.model = new GradientPanel({hue, saturation, lightness})
    this.gradient_panel_el = div({class: "bk-gradient-pnl"})
    const overlay_1 = div({class: "bk-gradient-pnl-overlay-1"})
    const overlay_2 = div({class: "bk-gradient-pnl-overlay-2"})
    overlay_1.appendChild(overlay_2)
    this.cursor_el = div({class: "bk-gradient-pnl-cursor-outer"})
    this.cursor_el.appendChild(div({class: "bk-gradient-pnl-cursor-inner"}))
    overlay_2.appendChild(this.cursor_el)
    this.gradient_panel_el.appendChild(overlay_1)
    this.gradient_panel_el.addEventListener("mousedown", (ev) =>
      this._drag_start(ev)
    )
    this.connect(this.model.properties.hue.change, () =>
      this._hue_to_background(this.model.hue)
    )
    this.connect(this.model.properties.saturation.change, () =>
      this._set_cursor_pos_x(this._sat_to_pos_x(this.model.saturation))
    )
    this.connect(this.model.properties.lightness.change, () =>
      this._set_cursor_pos_y(this._light_to_pos_y(this.model.lightness))
    )
    this._hue_to_background(this.model.hue)
    this._set_cursor_pos_x(this._sat_to_pos_x(this.model.saturation))
    this._set_cursor_pos_y(this._light_to_pos_y(this.model.lightness))
  }

  _update_cursor_position(pageX: number, pageY: number): void {
    const {left: pn_left, top: pn_top} = this.gradient_panel_el.getBoundingClientRect()
    const pos_x = pageX - pn_left
    const pos_y = pageY - pn_top
    this._set_cursor_pos_x(pos_x)
    this._set_cursor_pos_y(pos_y)
    this.model.setv({saturation: this._pos_x_to_saturation(pos_x), lightness: this._pos_y_to_lightness(pos_y)})
  }

  _set_cursor_pos_x(pos_x: number): void {
    const {width: cursor_width} = this.cursor_el.getBoundingClientRect()
    const {width: pn_width} = this.gradient_panel_el.getBoundingClientRect()
    const bound_pos_x = Math.max(Math.min(pos_x, pn_width), 0)
    const cursor_margin_left = `${Math.round(bound_pos_x - cursor_width / 2 - 1)}px`
    this.cursor_el.style.marginLeft = cursor_margin_left
  }

  _set_cursor_pos_y(pos_y: number): void {
    const {height: cursor_height} = this.cursor_el.getBoundingClientRect()
    const {height: pn_height} = this.gradient_panel_el.getBoundingClientRect()
    const bound_pos_y = Math.max(Math.min(pos_y, pn_height), 0)
    const cursor_margin_top = `${Math.round(bound_pos_y - cursor_height / 2 - 1)}px`
    this.cursor_el.style.marginTop = cursor_margin_top
  }

  _pos_x_to_saturation(pos_x: number): number {
    const {width: pn_width} = this.gradient_panel_el.getBoundingClientRect()
    const bound_pos_x = Math.max(Math.min(pos_x, pn_width), 0)
    return 100 * (bound_pos_x / pn_width)
  }

  _pos_y_to_lightness(pos_y: number): number {
    const {height: pn_height} = this.gradient_panel_el.getBoundingClientRect()
    const bound_pos_y = Math.max(Math.min(pos_y, pn_height), 0)
    return 100 * ((pn_height - bound_pos_y) / pn_height)
  }

  _hue_to_background(hue: number): void {
    this.gradient_panel_el.style.backgroundColor = hsl_to_hex({
      hue: hue,
      saturation: 100,
      lightness: 50,
    })
  }

  _sat_to_pos_x(saturation: number): number {
    const {width} = this.gradient_panel_el.getBoundingClientRect()
    return (saturation * width) / 100
  }

  _light_to_pos_y(lightness: number): number {
    const {height} = this.gradient_panel_el.getBoundingClientRect()
    return height - (lightness * height) / 100
  }

  _drag_start = (event: MouseEvent) => {
    event.preventDefault()
    this._update_cursor_position(event.pageX, event.pageY)
    document.addEventListener("mouseup", this._drag_stop)
    document.addEventListener("mousemove", this._drag_move)
  }

  _process_drag_move(event: MouseEvent): void {
    this._update_cursor_position(event.pageX, event.pageY)
  }

  _drag_move = (event: MouseEvent) => {
    this._process_drag_move(event)
  }

  _process_drag_stop(): void {
    document.removeEventListener("mouseup", this._drag_stop)
    document.removeEventListener("mousemove", this._drag_move)
  }

  _drag_stop = () => {
    this._process_drag_stop()
  }
}

namespace GradientPanel {
  export type Attrs = p.AttrsOf<Props>

  export type Props = Widget.Props & {
    hue: p.Property<number>
    saturation: p.Property<number>
    lightness: p.Property<number>
  }
}

interface GradientPanel extends GradientPanel.Attrs {}

class GradientPanel extends Widget {
  properties: GradientPanel.Props

  constructor(attrs?: Partial<GradientPanel.Attrs>) {
    super(attrs)
  }

  static init_GradientPanel(): void {

    this.define<GradientPanel.Props>({
      hue:          [p.Number,    0],
      saturation:   [p.Number,  100],
      lightness:    [p.Number,  100],
    })
  }
}


class HueSliderView extends Signalable()  {
  hue_slider_el: HTMLDivElement
  protected cursor_el: {arrow_left: HTMLDivElement, arrow_right: HTMLDivElement}
  protected bar: HTMLDivElement
  model: HueSlider

  constructor(hue: number) {
    super()
    this.model = new HueSlider({hue})
    this.hue_slider_el = div({
      class: "bk-hue-sld-ctn",
    })
    this.bar = div({class: "bk-hue-sld-bar"})
    this.cursor_el = {
      arrow_left: div({class: "bk-hue-sld-larr"}),
      arrow_right: div({class: "bk-hue-sld-rarr"}),
    }
    this.hue_slider_el.appendChild(this.cursor_el.arrow_left)
    this.hue_slider_el.appendChild(this.bar)
    this.hue_slider_el.appendChild(this.cursor_el.arrow_right)
    this._set_cursor_pos(this._hue_to_pos(hue))
    this.hue_slider_el.addEventListener("mousedown", (ev) => this._drag_start(ev))
    this.connect(this.model.properties.hue.change, () => this._set_cursor_pos(this._hue_to_pos(this.model.hue)))
  }

  _set_cursor_pos(pos: number): void {
    const {height: cursor_height} = this.cursor_el.arrow_left.getBoundingClientRect()
    const cursor_margin = `${Math.round(pos - cursor_height / 2 + 1)}px`
    this.cursor_el.arrow_left.style.marginTop = cursor_margin
    this.cursor_el.arrow_right.style.marginTop = cursor_margin
  }

  _update_cursor_position(pageY: number): void {
    const {height: slider_height, top: slider_top} = this.hue_slider_el.getBoundingClientRect()
    const corrected_pos = pageY - slider_top
    const bound_pos = Math.max(Math.min(corrected_pos, slider_height), 0)
    this._set_cursor_pos(bound_pos)
    this.model.hue = this._pos_to_hue(bound_pos)
  }

  _hue_to_pos(hue: number): number {
    const {height: slider_height} = this.hue_slider_el.getBoundingClientRect()
    return slider_height - ((Math.round(hue) % 360) * slider_height) / 359
  }

  _pos_to_hue(pos: number): number {
    const {height: slider_height} = this.hue_slider_el.getBoundingClientRect()
    return (359 * (slider_height - pos)) / slider_height //[0;359]
  }

  _drag_start = (ev: MouseEvent) => {
    ev.preventDefault()
    this._update_cursor_position(ev.pageY)
    document.addEventListener("mouseup", this._drag_stop)
    document.addEventListener("mousemove", this._drag_move)
  }

  _process_drag_move(ev: MouseEvent): void {
    this._update_cursor_position(ev.pageY)
  }

  _drag_move = (ev: MouseEvent) => {
    this._process_drag_move(ev)
  }

  _process_drag_stop(ev: MouseEvent): void {
    document.removeEventListener("mousemove", this._drag_move)
    document.removeEventListener("mouseup", this._drag_stop)
    this._update_cursor_position(ev.pageY)
  }

  _drag_stop = (ev: MouseEvent) => {
    this._process_drag_stop(ev)
  }
}

namespace HueSlider {
  export type Attrs = p.AttrsOf<Props>
  export type Props = Widget.Props & {
    hue: p.Property<number>
  }
}

interface HueSlider extends HueSlider.Attrs {}

class HueSlider extends Widget {
  properties: HueSlider.Props

  constructor(attrs?: Partial<HueSlider.Attrs>) {
    super(attrs)
  }

  static init_HueSlider(): void {
    this.define<HueSlider.Props>({
      hue: [p.Number, 0],
    })
  }
}

/***********************************
Functions and types to works with convertion between hex hsl and rgb
************************************/

type RGB = {
  red: number
  green: number
  blue: number
}

type HSL = {
  hue: number
  saturation: number
  lightness: number
}

type HEX = string

function hex_to_rgb(hex: HEX): RGB {
  const hex_num = parseInt(hex.indexOf("#") > -1 ? hex.substring(1) : hex, 16)
  return {red: hex_num >> 16, green: (hex_num & 0x00ff00) >> 8, blue: hex_num & 0x0000ff}
}

function hex_to_hsl(hex: string): HSL {
  return rgb_to_hsl(hex_to_rgb(hex))
}

/**
 * Convert hue, saturation and lightness values to red, green, blue values
 * @param {HSL} {h, s, l} - object with 0<=hue, 0<=s<=100, , 0<=l<=100
 * @return {RGB} {r, g, b} - object with r, g, b values between 0 and 255
 */
function hsl_to_rgb({hue: h, saturation: s, lightness: l}: HSL): RGB {
  console.assert(0 <= h, `Hue value must be positive: ${h}`)
  console.assert(
    0 <= s && s <= 100,
    `Saturation value must be between 0 and 100: ${s}`
  )
  console.assert(
    0 <= l && l <= 100,
    `Lightness value must be between 0 and 100: ${l}`
  )
  const hmod = h % 360
  const snorm = s / 100
  const lnorm = l / 100
  const c = (1 - Math.abs(2 * lnorm - 1)) * snorm
  const x = c * (1 - Math.abs(((hmod / 60) % 2) - 1))
  const m = lnorm - c / 2
  let rp, gp, bp
  if (0 <= hmod && hmod < 60) [rp, gp, bp] = [c, x, 0]
  else if (60 <= hmod && hmod < 120) [rp, gp, bp] = [x, c, 0]
  else if (120 <= hmod && hmod < 180) [rp, gp, bp] = [0, c, x]
  else if (180 <= hmod && hmod < 240) [rp, gp, bp] = [0, x, c]
  else if (240 <= hmod && hmod < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]

  return {
    red: Math.round((rp + m) * 255),
    green: Math.round((gp + m) * 255),
    blue: Math.round((bp + m) * 255),
  }
}

/**
 * Convert red, green, blue values to hue, saturation and lightness values
 * @param {RGB} {r, g, b} - object with r, g, b values between 0 and 255
 * @return {HSL} {h, s, l} - object with 0<=hue<=360, 0<=s<=100, , 0<=l<=100
 */
function rgb_to_hsl({red: r, green: g, blue: b}: RGB): HSL {
  const cmin = Math.min(r, g, b)
  const cmax = Math.max(r, g, b)
  const delta = cmax - cmin
  let h, s, l

  l = (cmax + cmin) / 2

  if (delta == 0)
    h = 0
  else if (cmax == r)
    h = 60 * (((g - b) / delta) % 6)
  else if (cmax == g)
    h = 60 * ((b - r) / delta + 2)
  else
    h = 60 * ((r - g) / delta + 4)

  h = h >= 0 ? h % 360 : 360 - (Math.abs(h) % 360)
  s = delta == 0 ? 0 : delta / ((255 - Math.abs(2 * l - 255)) / 255)
  return {hue: Math.round(h), saturation: Math.round((s * 100) / 255), lightness: Math.round((l * 100) / 255)}
}

function rgb_to_hex(rgb: RGB): HEX {
  const hex = [rgb.red.toString(16), rgb.green.toString(16), rgb.blue.toString(16)]
  hex.forEach((val, idx) => {
    if (val.length == 1) {
      hex[idx] = "0" + val
    }
  })
  return "#" + hex.join("")
}

function hsl_to_hex(hsl: HSL): HEX {
  return rgb_to_hex(hsl_to_rgb(hsl))
}
