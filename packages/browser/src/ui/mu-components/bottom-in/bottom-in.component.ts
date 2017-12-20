import {  Component, 
          OnInit, 
          OnDestroy,
          AfterViewInit,
          Inject, 
          Input,
          HostBinding,
          HostListener,
          Renderer2,
          ElementRef,
          ComponentFactoryResolver, 
          ComponentFactory,
          ViewContainerRef,
          ComponentRef,
          ChangeDetectorRef,
          ViewChild }           from '@angular/core'

import {  ActivatedRoute }      from '@angular/router'

import { Nail,
         NailInterface,
         AXIS, UiRouter, 
         BottomInInterface, 
         InjectionParentBase, 
         LOG_LEVEL, 
         RunContextBrowser}     from '@mubble/browser'

import {  query, 
          style, 
          state,
          trigger,
          transition, 
          group,
          animate }             from "@angular/animations"

import { DomHelper }            from '@mubble/browser'
import * as $                   from 'jquery'
import { Mubble }               from '@mubble/core'

const STATE             = {HALF: 'HALF', FULL: 'FULL'},
      ROUTE_ANIM_MS     = 400,
      PAN_ANIM_MS       = '300ms',
      QUICK_ANIM_MS     = DomHelper.getQuickAnim(),
      COMMIT_RATIO      = 1 / 3,
      FAST_COMMIT_RATIO = COMMIT_RATIO / 2,
      QUICK_SPEED       = .3

@Component({
  templateUrl: './bottom-in.component.html',
  styleUrls: ['./bottom-in.component.scss'],
  animations: [
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
          query('div.main', [
            style(DomHelper.getPercentTransform(0, 100)),
            animate(ROUTE_ANIM_MS, style('*'))
          ])
        ])
      ]),
      transition(':leave', [
        group([
          animate(ROUTE_ANIM_MS, style({
            opacity: 0
          })),
          query('div.main', [
            animate(ROUTE_ANIM_MS, style({
              transform: 'translate3d(0, 100%, 0)'
            }))
          ])
        ])
      ])
    ])
  ]
})

export class BottomInComponent extends InjectionParentBase implements  
    AfterViewInit, NailInterface, OnDestroy {

  @HostBinding('@routeAnimation') __routeAnimation  = null
  @HostBinding('class.animated-element') animElem   = true
  // @HostBinding('style.z-index')   zIndex   = 2000
 
  @HostListener('click', ['$event.target']) onHostClick() {
    if (this.state === STATE.HALF) {
      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Dismissing bottom-in due to host click')
      this.animateClose()
    }
  }

  @HostListener('@routeAnimation.start', ['$event']) onRouteAnimationStart(event) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onRouteAnimation-start', event)
    // console.log(event)
  }

  @HostListener('@routeAnimation.done', ['$event']) onRouteAnimationDone(event) {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onRouteAnimation-end', event)
    // console.log(event)
    if (this.childRequestedClose && this.injectedComponent.closeFromParent) this.injectedComponent.closeFromParent()
  }

  @ViewChild('main')                                main          : ElementRef
  @ViewChild('header')                              header        : ElementRef
  @ViewChild('compContainer')                       compContainer : ElementRef

  @ViewChild('injectAt', {read: ViewContainerRef})  injectAt;

  injectedComponent : BottomInInterface

  private top       : number
  @Input() title    : string  = ''
  @Input() state    : string = STATE.HALF
  @Input() allowFullPage: boolean = true

  private panY      : number
  private animValue : string

  private panYMin   : number
  private panYMax   : number
  private nail      : Nail
  private routeName : string
  private startTop  : number 

  constructor(@Inject('RunContext') rc: RunContextBrowser,
              router: UiRouter,
              route: ActivatedRoute,
              componentFactoryResolver: ComponentFactoryResolver,
              private renderer: Renderer2,
              private ref: ChangeDetectorRef) {

    super(rc, router, componentFactoryResolver, route)
    rc.setupLogger(this, 'BottomIn', LOG_LEVEL.DEBUG)
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'constructor')

    if (rc.getGlobalLogLevel() === LOG_LEVEL.DEBUG) {
      window['bi'] = this
    }
  }

  onRouterInit(params: Mubble.uObject<any>) {

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onRouterInit')

    super.onRouterInit(params, this.injectAt, false)

    this.title          = this.injectedComponent.getTitle()

    let halfHeight = this.injectedComponent.getHalfHeight()

    if (halfHeight) {

      if (halfHeight > document.body.clientHeight) {
        this.rc.isError() && this.rc.error(this.rc.getName(this), 'Half height passed is incorrect', 
          {halfHeight, clientHeight: document.body.clientHeight})
          halfHeight = 0.8 * document.body.clientHeight
      }

      this.top = document.body.clientHeight - halfHeight
    } else {
      this.allowFullPage = false
    }
  }
  
  ngAfterViewInit() {

    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'ngAfterViewInit')

    this.state      = STATE.HALF
    this.panYMax    = document.body.clientHeight

    const $compCont    = $(this.compContainer.nativeElement),
          compHeight   = $compCont.height(),
          headerHeight = $(this.header.nativeElement).height()

    if (this.allowFullPage) {
      
      this.panYMin    = 0
      $compCont.height(document.body.clientHeight - headerHeight)

    } else {
      this.top      = document.body.clientHeight - (compHeight + headerHeight)
      this.panYMin  = this.top
    }

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
    'ngAfterViewInit: Component container', {
      clientHeight: document.body.clientHeight,
      compHeight, headerHeight, 
      top: this.top
    })
    
    this.main.nativeElement.style.transform = DomHelper.getTransform(0, this.top, 0).transform
    
    this.nail       = new Nail( this.rc, 
                                this.main.nativeElement, 
                                this, 
                                this.renderer,
                                {axisX: false, axisY: true})

    this.ref.detectChanges()
  }

  onPanStart() {

    this.startTop = this.compContainer.nativeElement.scrollTop
    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onPanStart', {
    //   panY: this.panY, state: this.state})
  }

  onPanMove(event: any): boolean {

    let deltaY = event.deltaY
    if (this.compContainer.nativeElement.scrollTop) {
      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'cancelling panMove',
        {scrollTop: this.compContainer.nativeElement.scrollTop} )
      return false
    }
    if (deltaY > 0) deltaY -= this.startTop
  
    let y = (this.state === STATE.HALF ? this.top : this.panYMin) + deltaY

    if (y < this.panYMin) {
      y = this.panYMin
    } else if (y > this.panYMax) {
      y = this.panYMax
    }

    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onPanMove', {
    //   type: event.type, deltaY, y, panY: this.panY, state: this.state
    // })

    const needAnimate = this.panY !== y

    if (needAnimate) this.nail.requestAnimate(y)
    return needAnimate
  }

  onPanAnimate(y: number) {
    this.animateChange(y, false)
  }

  onPanEnd(event: any) {

    // this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'onPanEnd', {
    //   type: event.type, panY: this.panY, top: this.top, speed: event.speed
    // })

    if (this.state === STATE.HALF) {

      if (this.panY > this.top) {
        this.animateClose()
      } else if (this.panY < this.top) {
        this.onFull(true)
      } else {
        this.onHalf(true)
      }

    } else { // full

      if (this.panY > this.panYMin) {
        this.animateClose()
      } else {
        this.onFull(true)
      }

    }
  }

  onClick(event: any) {
    event.preventDefault()
    event.stopPropagation()
  }

  ngOnDestroy() {
    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'ngOnDestroy')
    super.ngOnDestroy()
    if (this.nail)      this.nail.destroy()
  }

  onHalf(runAnimation: boolean) {
    this.state = STATE.HALF
    this.animateChange(this.top, runAnimation)
  }

  onFull(runAnimation: boolean) {
    this.state = STATE.FULL
    this.animateChange(this.panYMin, runAnimation)
  }

  animateChange(y: number, runAnimation: boolean) {

    if (this.panY !== y) {

      this.panY = y

      const animValue = runAnimation ? PAN_ANIM_MS : QUICK_ANIM_MS

      if (this.animValue !== animValue) {
        this.animValue = animValue
        this.main.nativeElement.style.transition = animValue
      }
      
      DomHelper.setTransform(this.main.nativeElement, 0, y, 0)
    }
  }

  animateClose() {
    this.router.goBack()
  }
}   
