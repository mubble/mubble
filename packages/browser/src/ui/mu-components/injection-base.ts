import {  Component, 
          OnInit, 
          OnDestroy,
          AfterViewInit,
          Inject, 
          Input,
          SkipSelf,
          HostBinding,
          HostListener,
          Renderer2,
          ElementRef,
          ComponentFactoryResolver, 
          ComponentFactory,
          ViewContainerRef,
          ComponentRef,
          ChangeDetectorRef,
          ViewChild, 
          Directive}                 from '@angular/core'

import { ActivatedRoute }             from '@angular/router'
import { InjectionCaller,
         InjectionParent, 
         InjectedChild, 
         INJECTION_PARAM }            from './injection-interface'

import { UiRouter }                   from '../router/ui-router'
import { RunContextBrowser }          from '../../rc-browser'
import { Mubble }                     from '@mubble/core'

@Directive()
export abstract class InjectionParentBase implements OnDestroy, InjectionParent {

  childRequestedClose : boolean
  injectedComponent   : InjectedChild
  private icRef       : ComponentRef<any>
  caller              : InjectionCaller
  
  constructor(public  rc: RunContextBrowser,
              public  router: UiRouter, 
              private componentFactoryResolver: ComponentFactoryResolver,
              private route: ActivatedRoute) {

  }

  onRouterInit(params: Mubble.uObject<any>, injectAt: ViewContainerRef, showTitle: boolean) {

    this.rc.isStatus() && this.rc.status(this.rc.getName(this), 'onRouterInit called with', params)
    
    if (!this.injectedComponent) {
      this.injectComponent(params.inject, injectAt)
      this.caller = params[INJECTION_PARAM.CALLER]
      if (this.injectedComponent.initFromParent) this.injectedComponent.initFromParent(this, showTitle)
      if (this.caller && this.injectedComponent.setCaller) this.injectedComponent.setCaller(this.caller)
    }
    if (this.injectedComponent.setParam) this.injectedComponent.setParam(params)
  }

  // onInit(injectAt: ViewContainerRef, showTitle: boolean) {

  //   this.querySub = this.route.queryParams.subscribe(inParams => {

  //     const params = this.router.getQueryParams(inParams)
  //     this.rc.isStatus() && this.rc.status(this.rc.getName(this), 'ngOnInit called with', params)

  //     if (!this.injectedComponent) {
  //       this.injectComponent(params.inject, injectAt)
  //       this.caller = params[INJECTION_PARAM.CALLER]
  //       if (this.injectedComponent.initFromParent) this.injectedComponent.initFromParent(this, showTitle)
  //       if (this.caller && this.injectedComponent.setCaller) this.injectedComponent.setCaller(this.caller)
  //     }
  //     if (this.injectedComponent.setParam) this.injectedComponent.setParam(params)
  //   })
  // }

  private injectComponent(compName, injectAt: ViewContainerRef) {
    
      const component = this.router.getComponent(compName)
      
      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), component)

      const factory:ComponentFactory<any>  = this.componentFactoryResolver.resolveComponentFactory(component)
      this.icRef = injectAt.createComponent(factory)

      this.icRef.changeDetectorRef.detectChanges()
      this.injectedComponent = this.icRef.instance

      this.rc.isStatus() && this.rc.status(this.rc.getName(this), 'Injected component with', 
        {injected: !!this.injectedComponent, factory: !!factory})
  }

  close() {
    this.childRequestedClose = true
    this.router.goBack()
  }

  ngOnDestroy() {
    if (this.icRef) this.icRef.destroy()
  }
}