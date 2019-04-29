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
          ViewContainerRef,
          ComponentRef,
          ChangeDetectorRef,
          ViewChild }                 from '@angular/core'
          
import { Router, ActivatedRoute }     from '@angular/router'
import { ModalInterface, 
         InjectionParentBase, 
         RunContextBrowser, 
         LOG_LEVEL, UiRouter }        from '@mubble/browser'

import { query, 
         style, 
         state,
         trigger,
         transition, 
         group,
         animate }                    from "@angular/animations"

import { Mubble }                     from '@mubble/core'
import { DomHelper }                  from '@mubble/browser'

const ROUTE_ANIM_MS     = 400

@Component({
  selector    : 'modal-popup',
  templateUrl: './modal-popup.component.html',
  styleUrls: ['./modal-popup.component.scss'],
  animations: [
    // trigger('routeAnimation', [
    //   state('*', 
    //     style({
    //       'background-color': 'rgba(31,30,76, 0.6)', //primary color's 900 shade
    //       opacity: 1
    //     })
    //   ),

    //   transition(':enter', [
    //     style({
    //       'background-color': 'rgba(0,0,0,0)',
    //       opacity: 1
    //     }),
    //     animate('1500ms')
    //   ]),
      
    //   transition(':leave', [
    //     animate('500ms', style({
    //       'background-color': 'rgba(0,0,0,0)',
    //       opacity: 0
    //     }))
    //   ])
    // ]),

    // trigger('ccAnimate', [
    //   state('*',
    //     style({
    //       'transform': 'rotateX(0deg)',
    //     })
    //   ),

    //   transition(':enter', [
    //     style({
    //       'transform': 'rotateX(90deg)',
    //     }),
    //     animate('300ms cubic-bezier(0.55, 0.055, 0.675, 0.19)')
    //   ])
      
    // ])    

    trigger('routeAnimation', [
      
      transition(':enter', [
        group([
          query(':self', [
            style({
              opacity: 0
            }),
            animate(ROUTE_ANIM_MS, style({
              opacity: 1
            }))
          ]),
          query('div.modal-root-div', [
            style({
              transform: 'rotateX(90deg)'
            }),
            animate(ROUTE_ANIM_MS, style('*'))
          ])
        ])
      ]),
      transition(':leave', [
        group([
          animate(ROUTE_ANIM_MS, style({
            opacity: 0
          }))
        ])
      ])
    ])
  ]
})

export class ModalPopupComponent extends InjectionParentBase implements AfterViewInit, OnDestroy {

  @HostBinding('class.glb-flex-centered') true
  @HostBinding('@routeAnimation') __routeAnimation = true
  @HostBinding('class.glb-animated-element') animElem   = true
  // @HostBinding('style.z-index')   zIndex   = 3000;
  // @HostBinding('style.background-color') bg   = 'rgba(0,0,0,.5)'
 
  @HostListener('click', ['$event.target']) onHostClick() {
    this.animateClose()
  }
  @HostListener('@routeAnimation.start', ['$event']) onRouteAnimationStart(event) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onRouteAnimation-start', event)
  }

  @HostListener('@routeAnimation.done', ['$event']) onRouteAnimationDone(event) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onRouteAnimation-end', event)
    if (this.childRequestedClose &&  this.injectedComponent.closeFromParent) {
      if (this.routeEndProcessed) return
      this.routeEndProcessed  = true
      this.injectedComponent.closeFromParent()
    } else if (this.backPressed && this.injectedComponent.onBackPressed) {
      if (this.routeEndProcessed) return
      this.routeEndProcessed  = true
      this.injectedComponent.onBackPressed()
    }
  }

  @ViewChild('componentContainer') componentContainer: ElementRef
  @ViewChild('injectAt', {read: ViewContainerRef}) injectAt;

  injectedComponent : ModalInterface
  private backPressed : boolean
  private routeEndProcessed : boolean = false
  
  @Input() width:string = "75vw"

  constructor(@Inject('RunContext') rc: RunContextBrowser, 
              router: UiRouter,
              route: ActivatedRoute,
              componentFactoryResolver: ComponentFactoryResolver,
              private renderer: Renderer2,
              private ref: ChangeDetectorRef) {

    super(rc, router, componentFactoryResolver, route)
    
    rc.setupLogger(this, 'ModalPopup', LOG_LEVEL.DEBUG)
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'constructor')
  }

  onRouterInit(params: Mubble.uObject<any>) {
    
    super.onRouterInit(params, this.injectAt, true)
    this.width = this.injectedComponent.getWidth()
  }

  ngAfterViewInit() {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'ngAfterViewInit')
  }

  onClick(event: any) {
    event.preventDefault()
    event.stopPropagation()
  }

  ignoreScroll(event : any) {
    event.preventDefault();
    event.stopPropagation();
  }

  ngOnDestroy() {
    super.ngOnDestroy()
    this.rc.isStatus() && this.rc.status(this.rc.getName(this), 'ngOnDestroy')
  }

  animateClose() {

    if (this.injectedComponent.isNotDismissable && 
        this.injectedComponent.isNotDismissable()) {
      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      'Wont dismiss popup')
    } else {
      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      'Dismissing modal popup in due to host click')
      this.router.goBack()
    }
  }

  onBackPressed() {
    this.backPressed = true
  }

  canGoBack() {
    const childComponent  = this.injectedComponent
    return childComponent.canGoBack ? childComponent.canGoBack() : true
  }

}
