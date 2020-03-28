import load_font from './load_font';
import assert from '@brillout/assert';
import load_font_list from './load_font_list';
import ml from '../ml';
import set_background from './set_background';
import './tab-options.css';

export class TabOptions {
  constructor({
    option_spec_list,
    preset_spec_list,

    text_container,
    options_container,
    no_random_preset,

    on_any_change,
    on_font_change,

    enable_import_export,
    app_name,
  }) {
    this.option_list = instantiate_options({tab_options: this, option_spec_list});

    this.preset_list = new PresetList({preset_spec_list, tab_options: this});

    this.text_container = text_container;
    this.options_container = options_container;
    this.no_random_preset = no_random_preset;

    this.on_any_change = on_any_change;
    this.on_font_change = on_font_change;

    this.enable_import_export = enable_import_export;
    this.app_name = app_name;


    this.resolve_font_loaded_promise;
    this.font_loaded_promise = new Promise(r => this.resolve_font_loaded_promise = r);
  }

  generate_dom() {
    this.option_list.forEach(opt => {
      opt.generate_dom();
    });

    if( this.enable_import_export ){
      this.generate_import_export_dom();
    }

    this.global_side_effects({initial_run: true});
  }

  generate_import_export_dom() {
    {
      const btn = (
        new Button({
          tab_options: this,
          text: 'Customize',
          on_click: () => {
            assert(!this.selected_preset.is_creator_preset);
            this.modify_preset();
          },
        })
      );
      btn.generate_dom();
      this.button_mod = btn;
    }

    {
      const btn = (
        new Button({
          tab_options: this,
          text: 'Save as share-able URL',
          on_click: () => {
            assert(this.selected_preset.is_creator_preset);
            this.save_custom_preset();
            assert(!this.selected_preset.is_creator_preset);
            /* TODo
            const options_url = this.selected_preset.generate_url();
            alert(options_url);
            */
          },
        })
      );
      btn.generate_dom();
      this.button_url = btn;
    }

    {
      /* TODO
      this.button_del = opt;
      on_click: () => {
        this.active_preset.remove();
      }
      */
    }

    {
      const name_option = new TextOption({
        option_id: 'name',
        option_description: 'Name of your preset',
        option_default: '',
        tab_options: this,
      });
      name_option.generate_dom();
      this.name_option = name_option;
    }
  }

  save_custom_preset() {
    const preset_name = this.name_option.input_value;
    if( preset_name ){
      alert("You need to provide a preset name in order to save thepreset.");
    }

    const preset_options = {};
    this.option_list.forEach(option => {
      preset_options[option.option_id] = option.input_type;
    });

    const new_preset = new Preset({
      preset_name,
      preset_options,
      tab_options: this,
    });
    assert(!new_preset.is_invalid);

    this.preset_list.add_preset(new_preset);

    new_preset.save();

    this.select_preset(new_preset);

    // Erase all custom option values
    this.option_list.forEach(option => {
      option.reset();
    });
  }
  load_url_preset() {
    const data = retrieve_data_from_url();
    const {app_name, preset_options} = data;

    let {preset_name} = data;
    preset_name = this.preset_list.make_preset_name_unique(preset_name);

    const wrong_url_format = !preset_options;

    const wrong_app = app_name !== this.app_name;

    const new_preset = new Preset({
      preset_name,
      preset_options,
      tab_options: this,
    });
    const wrong_presets = new_preset.is_invalid;

    // Validation
    if( wrong_url_format || wrong_app || wrong_presets ){
      alert("URL is incorrect, maybe you inadvertently modified the URL?");
      if( wrong_app ) {
        alert("Wrong app: the URL hash should be loaded in a different app.");
      }
      return;
    }

    this.preset_list.add_preset(new_preset);

    new_preset.save();

    this.select_preset(new_preset);
  }

  modify_preset() {
    const {active_preset} = this;
    assert(!active_preset.is_creator_preset);
    Object.entries(active_preset.preset_options)
    .forEach(([opt_id, opt_val]) => {
      assert(!['preset_name', 'preset_id', 'id', 'name'].includes(opt_val));
      this
      .find_option(option => option.option_id === opt_id)
      .set_input_value(opt_val);
    });
    this.select_preset_creator();
  }


  global_side_effects({initial_run}={}) {
    this.update_background();
    this.update_font();
    this.update_option_visibility();
    this.update_button_visibility();
    this.load_font_list();
    this.on_any_change({initial_run});
  }

  update_background() {
    const image = this.current_backgroud_image;
    const color = this.current_backgroud_color;
    set_background(image || color);
  }
  async update_font() {
    const {text_container} = this;
    const get_font_name = () => this.current_font_name;
    await load_text_font({text_container, get_font_name});
    this.on_font_change();
    this.resolve_font_loaded_promise();
  }
  update_option_visibility() {
    // Visibility of options
    const get_input_val = dep_option_id => this.find_option(option => option.option_id === dep_option_id).input_value;
    this.option_list.forEach(opt => {
      const to_hide = (
        opt.option_dependency && !get_input_val(opt.option_dependency) ||
        opt.is_creator_option && !this.selected_preset.is_creator_preset
      );
      if( to_hide ){
        opt.hide();
      } else {
        opt.show();
      }
    });
  }
  update_button_visibility() {
    if( ! this.enable_import_export ){
      return;
    }
    if( this.selected_preset.is_creator_preset ){
      this.button_mod.hide();
      this.button_url.show();
      this.name_option.show();
   // this.button_del.hide();
    } else {
      this.button_url.hide();
      this.name_option.hide();
   // this.button_del.hide();
      if( !this.selected_preset.is_randomizer_preset ){
        this.button_mod.show();
      } else {
        this.button_mod.hide();
      }
    }
  }
  load_font_list() {
    if( !this.selected_preset.is_creator_preset ){
      return;
    }
    const fonts = this.preset_list.get_all_preset_fonts();
    const font_option_id = this.font_option.option_id;
    load_font_list({fonts, font_option_id});
  }


  find_option(match) {
    const option = this.option_list.find(match);
    assert(option);
    return option;
  }

  get background_image_option() {
    return this.find_option(option => option.is_background_image_option);
  }
  get current_backgroud_image() {
    return this.background_image_option.active_value;
  }

  get background_color_option() {
    return this.find_option(option => option.is_background_color_option);
  }
  get current_backgroud_color() {
    return this.background_color_option.active_value;
  }

  get font_option() {
    return this.find_option(option => option.is_font_option);
  }
  get current_font_name() {
    return this.font_option.active_value;
  }


  get active_preset() {
    let active_preset;

    const {selected_preset} = this;
    if( selected_preset.is_randomizer_preset ){
      active_preset = selected_preset.random_preset;
    } else {
      active_preset = selected_preset;
    }

    assert(!active_preset.is_randomizer_preset);
    assert(active_preset.preset_name);

    return active_preset;
  }
  set active_preset(preset_thing) {
    let preset_name;
    if( preset_thing.constructor===String ) {
      preset_name = preset_thing;
    }
    if( (preset_thing instanceof Preset) || (preset_thing instanceof FakePreset) ){
      preset_name = preset_thing.preset_name;
    }
    assert(preset_name, {preset_thing, preset_name});
    this.preset_option.set_input_value(preset_name);
  }
  select_preset_creator() {
    this.active_preset = this.preset_list.creator_preset;
  }
  select_preset(preset) {
    this.active_preset = preset;
  }

  get selected_preset() {
    const preset_name = this.preset_option.input_value;
    const preset = this.preset_list.get_preset_by_name(preset_name);
    return preset;
  }
  get preset_option() {
    return this.find_option(option => option.is_preset_selector);
  }

  get_option_value(option_id) {
    return (
      this
      .find_option(option => option.option_id === option_id)
      .active_value
    );
  }
}

class Button {
  constructor({on_click, text, tab_options}) {
    this.on_click = on_click;
    this.text = text;
    this.tab_options = tab_options;
  }
  generate_dom() {
    const dom_el =document.createElement('button'); 
    dom_el.setAttribute('type', 'button');
    dom_el.onclick = ev => {
      ev.preventDefault();
      this.on_click();
    };
    dom_el.textContent = this.text;
    const {options_container} = this.tab_options;
    options_container.appendChild(dom_el);

    this.dom_el = dom_el;
  }

  // to-do: as mixin
  hide() {
    hide_show_el(this.dom_el, true);
  }
  show() {
    hide_show_el(this.dom_el);
  }
}

class Option {
  constructor(props) {
    assert(props.option_id);
    assert(props.option_description);
    assert(props.tab_options);
    Object.assign(this, props);
  }

  generate_option() {
    this.generate_option_called = true;

    const {option_id, option_description} = this;
    const {input_tag, input_type} = this;
    assert(input_tag);
    assert(input_type || input_tag!=='input');
    const {label_el, input_el} = generate_option({input_tag, input_type, option_id, option_description});
    this.label_el = label_el;
    this.input_el = input_el;
  }

  generate_dom() {
    assert(this.generate_option_called);
    assert(this.input_el);
    assert(this.label_el);

    const on_input_change = () => {
      this.tab_options.global_side_effects();
    };

    const {options_container} = this.tab_options;
    const {label_el, input_tag, input_type, option_id, option_description, option_default} = this;

    activate_option({options_container, label_el, option_id, on_input_change, option_default});
  }

  get input_value() {
    return this.input_el.value;
  }
  get preset_value() {
    const preset_val = this.tab_options.active_preset.get_opt_value(this);
    return preset_val;
  }
  get active_value() {
    const {preset_value} = this;
    return preset_value!==null ? preset_value : this.input_value;
  }

  val_modifier(val) {
    this.input_el.value = val;
  }
  set_input_value(val) {
    this.val_modifier(val);
    // TODO?
    //  - Direclty trigger localStorage save and call global listener only once?
    //  - Or throttle global listener?
    this.input_el.dispatchEvent(new Event('change'));
  }

  hide() {
    hide_show_el(this.label_el, true);
  }
  show() {
    hide_show_el(this.label_el);
  }

  reset() {
    // TODO
  }
}

class DateOption extends Option {
  constructor(args) {
    super(args);
    this.input_tag = 'input';
    this.input_type = 'datetime';
  }
  generate_dom() {
    this.generate_option();
    super.generate_dom();
  }
}

class BooleanOption extends Option {
  constructor(args) {
    super(args);
    this.input_tag = 'input';
    this.input_type = 'checkbox';
  }
  generate_dom() {
    this.generate_option();
    this.label_el['classList']['add']('pointer-cursor');
    super.generate_dom();
  }
  val_modifier(val) {
    if( !!val ){
      this.input_el.setAttribute('checked', "true");
    } else {
      this.input_el.removeAttribute('checked');
    }
  }
  get input_value() {
    return !!this.input_el.checked;
  }
}

class SelectOption extends Option {
  constructor(args) {
    super(args);
    this.input_tag = 'select';
  }
}

class ChoiceOption extends SelectOption {
  generate_dom() {
    this.generate_option();

    this.input_el.style.width = '100px';

    this.option_choices.forEach(choice => {
      const option_el = document.createElement('option');
      option_el.innerHTML = choice;
      option_el.value     = choice;
      this.input_el.appendChild(option_el);
    });

    super.generate_dom();
  }
}

class TextOption extends Option {
  constructor(args) {
    super(args);
    this.input_tag = 'input';
    this.input_type = 'text';
  }
  generate_dom() {
    this.generate_option();

    if( this.option_placeholder ) {
      this.input_el.placeholder = this.option_placeholder;
    }

    const prefill = this.option_placeholder || this.option_default;
    if( prefill ){
      this.input_el.size = prefill.length*3/4;
    } else {
      this.input_el.style.width = '35px';
    }

    super.generate_dom();
  }
}

class ColorOption extends Option {
  constructor(args) {
    super(args);
    this.input_tag = 'input';
    this.input_type = 'color';
  }
  generate_dom() {
    this.generate_option();
    this.input_el.style.width = '35px';
    this.label_el['classList']['add']('pointer-cursor');
    super.generate_dom();
  }
}
class TextColorOption extends ColorOption {
  /*
  local_side_effects() {
    this.tab_options.text_container.style.color = this.active_value;
  }
  */
}
class TextShadowOption extends TextOption {
  /*
  local_side_effects() {
    this.tab_options.text_container.style.textShadow = this.active_value;
  }
  */
}

class PresetOption extends SelectOption {
  constructor(args) {
    super(args);
    this.is_preset_selector = true;
  }

  generate_dom() {
    this.generate_option();

    this.input_el.style.width = '93px';

    // TN
    this.input_el.innerHTML  = '<option label="<Creator>" value="_creator">&lt;Creator&gt;</option>';
    if( !this.tab_options.no_random_preset ){
      this.input_el.innerHTML += '<option label="<Random>" value="_random">&lt;Random&gt;</option>';
    }
    const {preset_names} = this.tab_options.preset_list;
    preset_names.forEach(preset_name => {
      const option_el = document.createElement('option');
      option_el.innerHTML = prettify_preset_id(preset_name);
      option_el.value     = preset_name;
      this.input_el.appendChild(option_el);
    });

    super.generate_dom();
  }

  get input_value() {
    const val = super.input_value;

    // Older Clock Tab version saved creator selection as `''`;
    if( val==='' ){
      // Incentivize user to re-select the <Creator> preset
      return RandomizerPreset.randomizer_preset_name;
    }

    // New value is `_random`
    if( val==='random' ){
      return RandomizerPreset.randomizer_preset_name;
    }

    return val;
  }
}


class BackgroundImageOption extends TextOption {
  constructor(args) {
    super(args);
    this.is_background_image_option = true;
  }
}
class BackgroundColorOption extends ColorOption {
  constructor(args) {
    super(args);
    this.is_background_color_option = true;
  }
}

class TextFontOption extends SelectOption {
  constructor(args) {
    super(args);
    this.is_font_option = true;
  }
  generate_dom() {
    this.generate_option();
    this.input_el.style.width = '110px';
    super.generate_dom();
  }
}


async function load_text_font({text_container, get_font_name}) {
  const font_name = get_font_name();

  await load_font(font_name);

  if( font_name !== get_font_name() ){
    return;
  }

  if( font_name === text_container.style.fontFamily ){
    return;
  }

  text_container.style.fontFamily = font_name;
}

function generate_option({input_tag, input_type, option_id, option_description}) {
  assert(input_tag);
  assert(input_type || input_tag!=='input');
  assert(option_id);
  assert(option_description);

  const label_el = document.createElement('label');

  assert(['select', 'input'].includes(input_tag));
  const input_el = document.createElement(input_tag);
  input_el.id   = option_id;
  if( input_type ) input_el.setAttribute('type', input_type);

  const description_el = document.createElement('span');
  description_el.innerHTML = option_description;//+'&nbsp;';

  if( input_type==='checkbox' ){
    label_el.appendChild(input_el);
    label_el.appendChild(description_el);
  } else {
    label_el.appendChild(description_el);
    label_el.appendChild(input_el);
  }

  return {label_el, input_el};
}

function activate_option({options_container, label_el, option_id, on_input_change, option_default}) {
  assert(options_container);
  assert(label_el);
  assert(option_id);
  assert(on_input_change);
  assert(option_default!==undefined, {option_id});

  options_container.appendChild(label_el);

//ml.persistantInput=function(id,listener,default_,keyUpDelay,noFirstListenerCall)
  ml.persistantInput(
    option_id,
    on_input_change,
    option_default,
    0,
    true
  );
}

function hide_show_el(el, to_hide) {
  el.style.width      = to_hide ? '0px'     :''       ;
  el.style.height     = to_hide ? '0px'     :''       ;
  el.style.visibility = to_hide ? 'hidden'  :'visible';
  el.style.position   = to_hide ? 'absolute':''       ;
  el.style.zIndex     = to_hide ? '-1'      :''       ;
}

function instantiate_options({tab_options, option_spec_list}) {
  return (
    option_spec_list.map(({option_type, ...option_spec}) => {
      assert(option_spec.option_id, option_spec);
      const args = {
        ...option_spec,
        tab_options,
      };
      if( option_type === 'text-font-input' ){
        return new TextFontOption(args);
      }
      if( option_type === 'preset-input' ){
        return new PresetOption(args);
      }
      if( option_type === 'text-color-input' ){
        return new TextColorOption(args);
      }
      if( option_type === 'color-input' ){
        return new ColorOption(args);
      }
      if( option_type === 'text-shadow-input' ){
        return new TextShadowOption(args);
      }
      if( option_type === 'text-input' ){
        return new TextOption(args);
      }
      if( option_type === 'background-image-input' ){
        return new BackgroundImageOption(args);
      }
      if( option_type === 'background-color-input' ){
        return new BackgroundColorOption(args);
      }
      if( option_type === 'boolean-input' ){
        return new BooleanOption(args);
      }
      if( option_type === 'date-input' ){
        return new DateOption(args);
      }
      if( option_type === 'choice-input' ){
        return new ChoiceOption(args);
      }
      assert(false, {option_type});
    })
  );
}

function prettify_preset_id(preset_name) {
  return (
    preset_name
    .replace(/[_-]/g,' ')
    .split(' ')
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(' ')
  );
}

class PresetList {
  constructor({preset_spec_list, tab_options}) {
    this.tab_options = tab_options;
    this.randomizer_preset = new RandomizerPreset({preset_list: this});
    this.creator_preset = new CreatorPreset();
    // TODO make this._presets private
    this._presets = [];
    this.get_initial_presets(preset_spec_list);
  }
  get_initial_presets(preset_spec_list) {
    this.add_preset(this.randomizer_preset);
    this.add_preset(this.creator_preset);

    const {tab_options} = this;
    Object.entries(preset_spec_list).forEach(([preset_name, preset_options]) => {
      this.add_preset(new Preset({preset_name, preset_options, tab_options}));
    });
  }
  add_preset(preset) {
    this._presets.push(preset);
  }
  get preset_names() {
    return (
      this
      ._presets
      .filter(preset => preset.is_real_preset)
      .map(preset => {
        const {preset_name} = preset;
        assert(preset_name);
        return preset_name;
      })
    );
  }
  get_preset_by_name(preset_name) {
    assert(preset_name);
    for(let preset of this._presets){
      if( preset.preset_name === preset_name ){
        return preset;
      }
    }
    assert(false, {preset_name});
  }
  get_all_preset_fonts() {
    const preset_font_names = this._presets.map(preset => preset.preset_font_name);
    return preset_font_names;
  }
  make_preset_name_unique(preset_name) {
    if( !this.get_preset_by_name(preset_name) ){
      return preset_name;
    }
    /* TODO
    this._presets.forEach
    */
  }
}

class Preset {
  constructor({preset_name, preset_options, tab_options}) {
    assert(preset_name);
    assert(preset_options.constructor===Object);
    assert(tab_options);
    this.preset_name = preset_name;
    this.preset_options = preset_options;
    this.tab_options = tab_options;
  }
  get_opt_value(option) {
    const {option_id} = option;
    assert(option_id);
    const {preset_options} = this;
    if( option_id in preset_options ){
      const val = preset_options[option_id];
      assert(val!==null);
      return val;
    }
    return null;
  }
  get is_real_preset() {
    return (
      !this.is_invalid &&
      !this.is_randomizer_preset &&
      !this.is_creator_preset
    );
  }
  get is_invalid(){
    // TODO
    return false;
  }
  get preset_font_name() {
    const preset_font_name = (
      this.get_opt_value(this.tab_options.font_option)
    );
    assert(preset_font_name);
  }
  save() {
    assert(!this.is_invalid);
    // TODO
  }
  remove() {
    // TODO
  }
  generate_url() {
    const data__json = JSON.stringify(data);
    const data__base64 = window.atob(data__json);
  }
}

class FakePreset {
  get_opt_value() {
    return null;
  }
}

class RandomizerPreset extends FakePreset {
  constructor({preset_list}) {
    super();
    this.preset_name = RandomizerPreset.randomizer_preset_name;
    this.is_randomizer_preset = true;
    this.preset_list = preset_list;
  }
  get random_preset() {
    const random_preset = this.pick_random_preset();
    return random_preset;
  }
  pick_random_preset(){
    // TODO make private
    if( !this._picked ){
      const {preset_list} = this;
      const {preset_names} = preset_list;
      var idx = Math.floor(Math.random()*preset_names.length);
      const preset_name = preset_names[idx];
      this._picked = preset_list.get_preset_by_name(preset_name);
    }
    return this._picked;
  }
}
RandomizerPreset.randomizer_preset_name='_random';
/*
RandomizerPreset.test = preset_name => (
  preset_name==='_random'
);
*/

class CreatorPreset extends FakePreset {
  constructor() {
    super();
    this.preset_name = CreatorPreset.creator_preset_name;
    this.is_creator_preset = true;
  }
}
CreatorPreset.creator_preset_name='_creator';
/*
CreatorPreset.test = preset_name => (
  preset_name==='_creator'
);
*/


function generate_url() {
  // TODO
}

// TODO
function retrieve_data_from_url() {
  if( !data_url ){
    return null;
  }

  const _preset_options = {};

  // TODO
  validate_preset_options();

  return {app_name, preset_name, preset_options}
}
