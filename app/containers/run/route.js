import Ember from 'ember';
import C from 'ui/utils/constants';

export default Ember.Route.extend({
  model: function(params/*, transition*/) {
    var store = this.get('store');
    let lcIndex = params.launchConfigIndex;

    let emptyService = store.createRecord({
      type: 'scalingGroup', // @TODO switch back to service
      stackId: params.stackId,
      scale: 1,
      startOnCreate: true,
    });

    let emptyLc = store.createRecord({
      type: 'launchConfig',
      tty: true,
      stdinOpen: true,
      labels: { [C.LABEL.PULL_IMAGE]: C.LABEL.PULL_IMAGE_VALUE },
      restartPolicy: {name: 'always'},
    });

    var dependencies = {};
    if ( params.serviceId )
    {
      dependencies['service'] = store.find('service', params.serviceId);
    }
    else if ( params.containerId )
    {
      dependencies['container'] = store.find('container', params.containerId);
    }

    return Ember.RSVP.hash(dependencies, 'Load dependencies').then((results) => {

      if ( results.hasOwnProperty('service') ) {
        // Service Upgrade/Clone
        let service = results.service;
        if ( !service ) {
          return Ember.RVP.reject('Service not found');
        }

        if ( lcIndex === null ) {
          // If there are sidekicks, you need to pick one & come back
          if ( service.secondaryLaunchConfigs && service.secondaryLaunchConfigs.length ) {
            return Ember.Object.create({
              service: service,
              selectLaunchConfig: true,
            });
          } else {
            // Otherwise use primary
            lcIndex = -1;
          }
        }

        let clone = service.clone();
        let lc = clone.launchConfig;
        if ( lcIndex === -1 ) {
          lc = clone.launchConfig;
        } else {
          lc = clone.secondaryLaunchConfigs[lcIndex];
        }

        if ( params.upgrade) {
          // Upgrade service
          return Ember.Object.create({
            service: clone,
            launchConfig: lc,
            launchConfigIndex: lcIndex,
            isService: true,
            isUpgrade: true
          });
        } else {
          // Clone service
          let neu = store.createRecord(clone.serializeForNew());

          return Ember.Object.create({
            service: neu,
            launchConfig: lc,
            isService: true,
            isUpgrade: false
            // no launchConfigIndex because this will be a new service or sidekick
          });
        }
      } else if ( results.hasOwnProperty('container') ) {
        // Container Upgrade/Clone
        let container = results.container;
        if ( !container ) {
          return Ember.RVP.reject('Container not found');
        }

        let clone = container.clone();

        if ( params.upgrade) {
          emptyService.set('launchConfig', clone);
          return Ember.Object.create({
            service: emptyService,
            launchConfig: clone,
            isService: false,
            isUpgrade: true
          });
        } else {
          let neu = store.createRecord(clone.serializeForNew());
          emptyService.set('launchConfig', neu);
          return Ember.Object.create({
            service: emptyService,
            launchConfig: neu,
            isService: false,
            isUpgrade: false,
          });
        }
      } else {
        // New Container/Service
        emptyService.set('launchConfig', emptyLc);
        return Ember.Object.create({
          service: emptyService,
          launchConfig: emptyLc,
          isService: false,
          isUpgrade: false,
        });
      }
    });
  },

  resetController: function (controller, isExiting/*, transition*/) {
    if (isExiting)
    {
      controller.set('stackId', null);
      controller.set('serviceId', null);
      controller.set('containerId', null);
      controller.set('launchConfigIndex', null);
      controller.set('upgrade', null);
    }
  }
});
