import { RouteReuseStrategy, ActivatedRouteSnapshot, DetachedRouteHandle } from '@angular/router'
import { Injectable } from "@angular/core";

@Injectable()
export class RoutingStrategy implements RouteReuseStrategy {

  private preserveComponents = []
  private myStore = {}
  private logging = false

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    if (this.logging) console.info('RoutingStrategy:shouldDetach', this.logSnapshot(route), route)
    return this.isRemembered(route)
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle): void {

    if (this.logging) console.info('RoutingStrategy:store', this.logSnapshot(route), route)

    const name = this.getName(route)
    if (!name) return

    this.myStore[name] = handle
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    if (this.logging) console.info('RoutingStrategy:shouldAttach', this.logSnapshot(route), route)
    // return this.isRemembered(route)

    const name = this.getName(route)
    return name ? !!this.myStore[name] : false
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle {
    if (this.logging) console.info('RoutingStrategy:retrieve', this.logSnapshot(route), route)

    const name = this.getName(route)
    if (!name) return null

    return this.myStore[name]
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (this.logging) console.info('RoutingStrategy:shouldReuseRoute', future, this.logSnapshot(future), 
                curr, this.logSnapshot(curr))
    return future.routeConfig === curr.routeConfig;
  }

  private logSnapshot(route: ActivatedRouteSnapshot) {
    const name = this.getName(route)
    return (name || 'null') + ':' + 
           (route.url && route.url.length ? route.url[0] : 'none')
  }

  private isRemembered(route: ActivatedRouteSnapshot): boolean {
    const name = this.getName(route)
    return name ? this.preserveComponents.indexOf(name) !== -1 : false
  }

  private getName(route: ActivatedRouteSnapshot): string {
    if (!route.component) return ''
    return (route.component as any).name
  }
}