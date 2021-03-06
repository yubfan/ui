import Ember from 'ember';
import NewOrEdit from 'ui/mixins/new-or-edit';

const SPECIAL = {
  'rancher-nfs': 'editVolume.driver.nfs',
  'rancher-ebs': 'editVolume.driver.ebs',
  'rancher-efs': 'editVolume.driver.efs',
  'longhorn': 'editVolume.driver.longhorn',
}

const HIDE = [
  'rancher-secrets',
];

export default Ember.Component.extend(NewOrEdit, {
  intl: Ember.inject.service(),

  model: null,
  scope: 'global',
  stack: null,
  selectStack: true,
  isUpgrade: false,
  actuallySave: true,

  customDriver: false,

  init() {
    window.nev = this;
    this._super(...arguments);

    let choices = this.get('driverChoices');
    if ( choices.get('length') === 0 ) {
      this.set('customDriver',true);
    } else if ( !this.get('model.driver') ) {
      this.set('model.driver', choices.get('firstObject.value'));
    }

    if ( !this.get('stack') ) {
      this.set('stack', this.get('store').all('stack').findBy('isDefault',true));
    }
  },

  actions: {
    cancel: function() {
      this.sendAction('cancel');
    },

    toggleCustomDriver() {
      this.toggleProperty('customDriver');

      let standard = !!this.get('driverChoices').findBy('value', this.get('model.driver'));
      if ( !this.get('customDriver') && !standard ) {
        this.set('model.driver', null);
      }
    },
  },

  driverChoices: function() {
    let intl = this.get('intl');
    let choices = this.get('store').all('storagepool')
      .map((x) => x.driverName)
      .uniq()
      .filter((x) => !!x && !HIDE.includes(x))
      .map((driver) => {
        let key = SPECIAL[driver];
        if ( key ) {
          return { label: intl.t(key), value: driver, special: true };
        }
        return { label: driver, value: driver, special: false };
      }).sortBy('special:desc','label');

    return choices;
  }.property('intl.locale'),

  headerToken: function() {
    let k = 'editVolume.';
    k += (this.get('isUpgrade') ? 'upgrade' : 'add') + '.';
    k += this.get('scope');
    return k;
  }.property('isUpgrade','scope'),

  willSave() {
    let scope = this.get('scope');
    let pr;
    let type = 'volumeTemplate';

    if ( scope === 'global' ) {
      type = 'volume';
    }

    pr = this.get('store').createRecord(this.get('model'),{type: type});
    this.set('primaryResource', pr);

    let stackPromise;
    // Set the stack ID
    if ( scope === 'global' ) {
      stackPromise = Ember.RSVP.resolve();
    } else {
      if ( this.get('stack.id') ) {
        pr.set('stackId', this.get('stack.id'));
        stackPromise = Ember.RSVP.resolve();
      } else if ( this.get('stack') && this.get('stack.name') ) {
        stackPromise = this.get('stack').save().then((newStack) => {
          pr.set('stackId', newStack.get('id'));
        });
      } else {
        stackPromise = Ember.RSVP.reject('Stack is required');
      }
    }

    let sup = this._super;
    return stackPromise.then(() => {
      let ok = sup.apply(this,...arguments);
      return ok;
    }).catch(() => {
      return false;
    });
  },

  doSave() {
    if ( this.get('actuallySave') ) {
      return this._super(...arguments);
    } else {
      let pr = this.get('primaryResource');
      let type = pr.get('type');
      this.sendAction('doSave', {
        scope: this.get('scope'),
        [type]: pr,
      });
    }
  },

  doneSaving() {
    this.sendAction('done');
  },
});
