extends Control
## Embeddable collection page. The host owns entry, campaign events and the permanent save path.
const Inspector = preload("codex_inspector.gd")
const CollectionState = preload("ceramic_collection_state.gd")
signal close_requested
signal selection_changed(id: String)
signal collection_changed(snapshot: Dictionary)
signal load_failed(id: String, error: int)

const INK := Color("302f2a")
const MUTED := Color("77776b")
const VERMILION := Color("9a4234")
var collection = CollectionState.new()
var entries: Array = []
var by_id: Dictionary = {}
var asset_root := ""
var current_group := "liangshan"
var selected_id := ""
var current_tier := "battle"
var ui_scale := 1.0
var inspector
var _request_serial := 0
var _rows: Dictionary = {}
var _thumbnail_cache: Dictionary = {}
var _visible_ids: Array[String] = []
var _body_font := SystemFont.new()
var _title_font := SystemFont.new()
var _title: Label
var _progress: Label
var _search: LineEdit
var _list: VBoxContainer
var _scroll: ScrollContainer
var _groups: Dictionary = {}
var _name: Label
var _nickname: Label
var _identity: Label
var _equipment: Label
var _status: Label
var _empty: Label
var _detail: Button
var _parts: GridContainer
var _part_buttons: Array[Button] = []
var _fonts: Array[Dictionary] = []
var _margins: MarginContainer
var _roster_column: VBoxContainer
var _info_column: VBoxContainer

func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_PASS
    _body_font.font_names = PackedStringArray(["Microsoft YaHei", "Noto Sans CJK SC"])
    _title_font.font_names = PackedStringArray(["KaiTi", "STKaiti", "Noto Serif CJK SC", "Microsoft YaHei"])
    var theme_value := Theme.new()
    theme_value.default_font = _body_font
    theme_value.default_font_size = 18
    theme = theme_value
    _build()
    resized.connect(queue_redraw)
    set_ui_scale(ui_scale)

func _draw() -> void:
    draw_rect(Rect2(Vector2.ZERO,size),Color("f3f0e5"))
    # Sparse paper fibres and ink strokes organize the page without enclosing panels.
    for i in range(56):
        var x := fmod(float(i*173+41),maxf(size.x,1.0))
        var y := fmod(float(i*239+87),maxf(size.y,1.0))
        draw_line(Vector2(x,y),Vector2(x+12.0+float(i%7),y-1),Color(0.41,0.38,0.30,0.035),1)
    draw_line(Vector2(28,106)*ui_scale,Vector2(size.x-28*ui_scale,106*ui_scale),Color(0.39,0.37,0.31,0.21),1)
    draw_line(Vector2(24*ui_scale,size.y-17*ui_scale),Vector2(size.x-24*ui_scale,size.y-17*ui_scale),Color(0.39,0.37,0.31,0.13),1)

func _label(text: String, points: int, tone := INK, title_font := false) -> Label:
    var label := Label.new()
    label.text=text
    label.add_theme_color_override("font_color",tone)
    label.add_theme_font_override("font",_title_font if title_font else _body_font)
    _fonts.append({"control":label,"points":points})
    label.add_theme_font_size_override("font_size",roundi(points*ui_scale))
    return label

func _button(text: String, action: Callable) -> Button:
    var button := Button.new()
    button.text=text
    button.custom_minimum_size=Vector2(46,44)*ui_scale
    button.focus_mode=Control.FOCUS_ALL
    button.pressed.connect(action)
    _fonts.append({"control":button,"points":17})
    button.add_theme_font_size_override("font_size",roundi(17*ui_scale))
    _style_button(button,false)
    return button

func _style_button(button: Button, chosen: bool) -> void:
    var normal:=StyleBoxFlat.new()
    normal.bg_color=Color(0.57,0.27,0.21,0.045) if chosen else Color.TRANSPARENT
    normal.content_margin_left=10*ui_scale
    normal.content_margin_right=10*ui_scale
    normal.border_width_bottom=2 if chosen else 0
    normal.border_color=VERMILION
    var hover:=normal.duplicate() as StyleBoxFlat
    hover.bg_color=Color(0.34,0.35,0.29,0.08)
    var focus:=StyleBoxFlat.new()
    focus.bg_color=Color.TRANSPARENT
    focus.border_width_left=3
    focus.border_color=VERMILION
    button.add_theme_stylebox_override("normal",normal)
    button.add_theme_stylebox_override("hover",hover)
    button.add_theme_stylebox_override("pressed",hover)
    button.add_theme_stylebox_override("disabled",normal)
    button.add_theme_stylebox_override("focus",focus)
    button.add_theme_color_override("font_color",VERMILION if chosen else INK)
    button.add_theme_color_override("font_hover_color",VERMILION)
    button.add_theme_color_override("font_focus_color",VERMILION)
    button.add_theme_color_override("font_disabled_color",MUTED)

func _build() -> void:
    _margins=MarginContainer.new()
    add_child(_margins)
    _margins.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    var page:=VBoxContainer.new()
    page.add_theme_constant_override("separation",10)
    _margins.add_child(page)
    var heading:=HBoxContainer.new()
    heading.custom_minimum_size.y=66
    page.add_child(heading)
    _title=_label("水浒 · 人物志",36,INK,true)
    _title.size_flags_horizontal=Control.SIZE_EXPAND_FILL
    heading.add_child(_title)
    _progress=_label("已识 0 / 108",18,VERMILION)
    heading.add_child(_progress)
    heading.add_child(_button("收卷",func():close_requested.emit()))
    var group_bar:=HBoxContainer.new()
    group_bar.add_theme_constant_override("separation",18)
    page.add_child(group_bar)
    for pair: Array in [["liangshan","梁山将"],["jianghu","江湖人物"],["equipment","兵器器物"]]:
        var group_button:=_button(pair[1],_select_group.bind(pair[0]))
        group_bar.add_child(group_button)
        _groups[pair[0]]=group_button
    var body:=HBoxContainer.new()
    body.size_flags_vertical=Control.SIZE_EXPAND_FILL
    body.add_theme_constant_override("separation",22)
    page.add_child(body)
    _roster_column=VBoxContainer.new()
    _roster_column.custom_minimum_size.x=260
    body.add_child(_roster_column)
    _search=LineEdit.new()
    _search.placeholder_text="寻姓名、绰号"
    _search.clear_button_enabled=true
    _search.custom_minimum_size.y=46
    var search_line:=StyleBoxFlat.new()
    search_line.bg_color=Color.TRANSPARENT
    search_line.border_width_bottom=1
    search_line.border_color=Color(0.4,0.4,0.34,0.35)
    search_line.content_margin_left=6
    _search.add_theme_stylebox_override("normal",search_line)
    _search.add_theme_stylebox_override("focus",search_line)
    _search.add_theme_color_override("font_color",INK)
    _search.add_theme_color_override("font_placeholder_color",MUTED)
    _fonts.append({"control":_search,"points":18})
    _search.text_changed.connect(func(_text:String):_refresh_list())
    _roster_column.add_child(_search)
    _scroll=ScrollContainer.new()
    _scroll.size_flags_vertical=Control.SIZE_EXPAND_FILL
    _scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED
    _roster_column.add_child(_scroll)
    _list=VBoxContainer.new()
    _list.size_flags_horizontal=Control.SIZE_EXPAND_FILL
    _list.add_theme_constant_override("separation",3)
    _scroll.add_child(_list)
    var model_column:=VBoxContainer.new()
    model_column.size_flags_horizontal=Control.SIZE_EXPAND_FILL
    body.add_child(model_column)
    var stage:=Control.new()
    stage.size_flags_vertical=Control.SIZE_EXPAND_FILL
    stage.custom_minimum_size=Vector2(260,240)
    model_column.add_child(stage)
    inspector=Inspector.new()
    inspector.transparent_background=true
    stage.add_child(inspector)
    inspector.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    _empty=_label("翻开名册，寻访梁山人物",22,MUTED,true)
    _empty.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
    _empty.vertical_alignment=VERTICAL_ALIGNMENT_CENTER
    _empty.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
    _empty.mouse_filter=Control.MOUSE_FILTER_IGNORE
    stage.add_child(_empty)
    _empty.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    inspector.hide()
    var tools:=HBoxContainer.new()
    tools.alignment=BoxContainer.ALIGNMENT_CENTER
    model_column.add_child(tools)
    tools.add_child(_button("－",func():inspector.zoom(1.0/1.25)))
    tools.add_child(_button("＋",func():inspector.zoom(1.25)))
    tools.add_child(_button("复位",func():inspector.reset_view()))
    tools.add_child(_button("正面",_look.bind(0.0)))
    tools.add_child(_button("背面",_look.bind(PI)))
    var hint:=_label("滚轮缩放 · 右键拖移 · 左键换角度",14,MUTED)
    hint.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
    model_column.add_child(hint)
    _info_column=VBoxContainer.new()
    _info_column.custom_minimum_size.x=230
    _info_column.add_theme_constant_override("separation",12)
    body.add_child(_info_column)
    _nickname=_label("见闻常存",18,VERMILION)
    _info_column.add_child(_nickname)
    _name=_label("人物志",36,INK,true)
    _info_column.add_child(_name)
    _identity=_label("",17,MUTED)
    _identity.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
    _info_column.add_child(_identity)
    _equipment=_label("",17,INK)
    _equipment.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
    _info_column.add_child(_equipment)
    _status=_label("见闻随旅程记入名册",16,MUTED)
    _status.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
    _info_column.add_child(_status)
    var spacer:=Control.new()
    spacer.custom_minimum_size.y=15
    _info_column.add_child(spacer)
    _detail=_button("高清细看",_toggle_detail)
    _detail.disabled=true
    _info_column.add_child(_detail)
    _parts=GridContainer.new()
    _parts.columns=2
    _parts.add_theme_constant_override("h_separation",8)
    _info_column.add_child(_parts)
    _refresh_counts()

func set_ui_scale(value: float) -> void:
    ui_scale=clampf(value,0.85,1.5)
    if not is_node_ready(): return
    for entry: Dictionary in _fonts:
        if is_instance_valid(entry["control"]):
            entry["control"].add_theme_font_size_override("font_size",roundi(entry["points"]*ui_scale))
    for side: String in ["left","right","top","bottom"]:
        _margins.add_theme_constant_override("margin_"+side,roundi((24 if side!="bottom" else 22)*ui_scale))
    # Widths scale moderately, leaving the model visible when the host enlarges text.
    _roster_column.custom_minimum_size.x=260*minf(ui_scale,1.15)
    _info_column.custom_minimum_size.x=230*minf(ui_scale,1.15)
    queue_redraw()

func configure(catalog: Dictionary, root_path: String, permanent_snapshot: Dictionary={}) -> int:
    if not is_node_ready() or not catalog.get("entries") is Array: return ERR_INVALID_PARAMETER
    entries=catalog["entries"].duplicate(true)
    by_id.clear()
    for entry: Dictionary in entries: by_id[str(entry["id"])]=entry
    asset_root=root_path
    collection.configure(catalog)
    var change: Dictionary=collection.merge_snapshot(permanent_snapshot)
    if int(change["error"])!=OK: return int(change["error"])
    _refresh_counts()
    _refresh_list()
    return OK

func apply_discoveries(character_ids: Array, equipment_ids: Array=[]) -> Dictionary:
    var result: Dictionary=collection.discover(character_ids,equipment_ids)
    if int(result["error"])==OK and (not result["characters"].is_empty() or not result["equipment"].is_empty()):
        collection_changed.emit(collection.snapshot())
        _refresh_counts()
        _refresh_list()
        if not selected_id.is_empty(): select_entry(selected_id)
    return result

func _refresh_counts() -> void:
    if _progress==null:return
    var total:=0
    for entry: Dictionary in entries:
        if entry["group"]=="liangshan" and collection.is_discovered(entry["id"],entry["kind"]):total+=1
    _progress.text="已识 %d / 108"%total
    for group: String in _groups: _style_button(_groups[group],group==current_group)

func _select_group(group: String) -> void:
    current_group=group
    _search.text=""
    _refresh_counts()
    _refresh_list()
    if not _visible_ids.is_empty():select_entry(_visible_ids[0])
    else:_show_empty("暂无条目")

func _refresh_list() -> void:
    _rows.clear()
    _visible_ids.clear()
    for child in _list.get_children():child.free()
    _fonts=_fonts.filter(func(entry:Dictionary):return is_instance_valid(entry["control"]))
    var query:=_search.text.strip_edges().to_lower()
    for entry: Dictionary in entries:
        if entry["group"]!=current_group:continue
        var haystack:=str(entry["name"])+str(entry.get("nickname",""))+" ".join(entry.get("aliases",[]))
        if not query.is_empty() and not haystack.to_lower().contains(query):continue
        var id:=str(entry["id"])
        var known: bool=collection.is_discovered(id,entry["kind"])
        _visible_ids.append(id)
        var row:=_button("",select_entry.bind(id))
        row.custom_minimum_size.y=58*ui_scale
        row.size_flags_horizontal=Control.SIZE_EXPAND_FILL
        row.tooltip_text=str(entry["name"]) if known else "尚未结识"
        _style_button(row,id==selected_id)
        var content:=HBoxContainer.new()
        content.mouse_filter=Control.MOUSE_FILTER_IGNORE
        row.add_child(content)
        content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
        content.offset_left=9;content.offset_right=-9
        content.add_theme_constant_override("separation",10)
        if known and entry.has("thumbnail"):
            var icon:=TextureRect.new()
            icon.mouse_filter=Control.MOUSE_FILTER_IGNORE
            icon.texture=_thumbnail(entry)
            icon.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
            icon.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
            icon.custom_minimum_size=Vector2(38,48)*ui_scale
            content.add_child(icon)
        else:
            var mark:=_label("·" if not known else "器",22,MUTED,true)
            mark.custom_minimum_size.x=38*ui_scale
            mark.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
            mark.mouse_filter=Control.MOUSE_FILTER_IGNORE
            content.add_child(mark)
        var number: String="%03d"%int(entry["rank"]) if entry["group"]=="liangshan" else ""
        var caption:=_label((number+"  " if not number.is_empty() else "")+(str(entry["name"]) if known else "未识人物" if entry["kind"]=="character-body" else "未识器物"),18,INK if known else MUTED)
        caption.mouse_filter=Control.MOUSE_FILTER_IGNORE
        content.add_child(caption)
        _list.add_child(row)
        _rows[id]=row
    if _visible_ids.is_empty():
        _list.add_child(_label("未寻得相应条目",17,MUTED))
        _show_empty("未寻得相应条目\n换个姓名或绰号再寻")

func _thumbnail(entry: Dictionary) -> Texture2D:
    var id:=str(entry["id"])
    if not _thumbnail_cache.has(id):
        var image:=Image.load_from_file(asset_root.path_join(entry["thumbnail"]["file"]))
        if image!=null and not image.is_empty():_thumbnail_cache[id]=ImageTexture.create_from_image(image)
    return _thumbnail_cache.get(id)

func select_entry(id: String) -> void:
    if not by_id.has(id):return
    var entry: Dictionary=by_id[id]
    if current_group!=entry["group"]:
        current_group=entry["group"]
        _search.text=""
        _refresh_counts()
        _refresh_list()
    selected_id=id
    current_tier="battle"
    for row_id: String in _rows:_style_button(_rows[row_id],row_id==id)
    _name.text=str(entry["name"]) if collection.is_discovered(id,entry["kind"]) else "尚未结识"
    _nickname.text=str(entry.get("nickname","")) if collection.is_discovered(id,entry["kind"]) else "留待旅途相逢"
    _identity.text=" · ".join([str(entry.get("star","")),str(entry.get("role",""))]).trim_prefix(" · ").trim_suffix(" · ") if collection.is_discovered(id,entry["kind"]) else ""
    _equipment.text="随身器物\n"+" · ".join(entry.get("equipmentNames",[])) if entry.has("equipmentNames") and collection.is_discovered(id,entry["kind"]) else ""
    _request_serial+=1
    if not collection.is_discovered(id,entry["kind"]):
        _release_model()
        _show_empty("尚未结识\n见闻将随旅程留存于此")
        _status.text="见闻随旅程记入名册"
        _clear_parts()
        _detail.disabled=true
        selection_changed.emit(id)
        return
    _status.text="展卷中…"
    _detail.disabled=true
    _load_selected.call_deferred(_request_serial,false)

func _load_selected(serial: int, keep_view: bool) -> void:
    if serial!=_request_serial or not by_id.has(selected_id):return
    var entry: Dictionary=by_id[selected_id]
    if not collection.is_discovered(selected_id,entry["kind"]):return
    var error: int=inspector.load_record(entry,current_tier,asset_root,keep_view)
    if error!=OK:
        _show_empty("暂时无法展看\n可稍后重试")
        _status.text="此件暂未能展看"
        _detail.disabled=true
        load_failed.emit(selected_id,error)
        return
    inspector.show()
    _empty.hide()
    _status.text="见闻已留存"
    _detail.disabled=false
    _detail.text="返回轻览" if current_tier=="inspector" else "高清细看"
    _build_parts(entry)
    selection_changed.emit(selected_id)

func _clear_parts() -> void:
    for child in _parts.get_children():child.free()
    _fonts=_fonts.filter(func(entry:Dictionary):return is_instance_valid(entry["control"]))
    _part_buttons.clear()

func _build_parts(entry: Dictionary) -> void:
    _clear_parts()
    var choices: Array=[["body","全身"],["head","眉眼"],["hands","双手"],["feet","足部"],["whole","含兵器"]] if entry["kind"]=="character-body" else [["whole","器物全貌"]]
    if entry["kind"]!="character-body":
        var number:=0
        for region: String in entry["inspectionRegionsGodotMetres"]:
            if region.begins_with("socket:"):
                number+=1
                choices.append([region,"局部 %d"%number])
    for choice: Array in choices:
        if not inspector.regions.has(choice[0]):continue
        var button:=_button(choice[1],_focus_part.bind(choice[0]))
        _parts.add_child(button)
        _part_buttons.append(button)

func _focus_part(part: String) -> void:
    if inspector.model!=null:inspector.focus_region(part)

func _toggle_detail() -> void:
    if inspector.model==null or _detail.disabled:return
    current_tier="battle" if current_tier=="inspector" else "inspector"
    _detail.disabled=true
    _status.text="展卷中…"
    _request_serial+=1
    _load_selected.call_deferred(_request_serial,true)

func _look(angle: float) -> void:
    if inspector.model==null:return
    inspector.yaw=angle
    inspector.pitch=0
    inspector._update_camera()

func _show_empty(message: String) -> void:
    inspector.hide()
    _empty.text=message
    _empty.show()

func _release_model() -> void:
    if inspector.model!=null:
        inspector.model.free()
        inspector.model=null
    inspector.current_id=""
    inspector.current_tier=""
    inspector.regions.clear()

func state() -> Dictionary:
    return {"selectedId":selected_id,"tier":current_tier,"group":current_group,"visibleIds":_visible_ids.duplicate(),"collection":collection.snapshot(),"view":inspector.view_state(),"modelVisible":inspector.visible,"emptyText":_empty.text if _empty.visible else "","progressText":_progress.text,"thumbnailCacheCount":_thumbnail_cache.size(),"mainGameModified":false}
