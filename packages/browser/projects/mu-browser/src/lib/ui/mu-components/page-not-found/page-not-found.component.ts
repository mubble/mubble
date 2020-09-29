import { Component, 
         OnInit,
         Inject
       }                      from '@angular/core'
import { RunContextBrowser } from '../../../rc-browser'

@Component({
  selector    : 'page-not-found',
  templateUrl : './page-not-found.component.html',
  styleUrls   : ['./page-not-found.component.scss']
})

export class PageNotFoundComponent implements OnInit {

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser) { }

  ngOnInit() {

  }

  /*=====================================================================
                                  HTML
  =====================================================================*/

  onHomeClick() {
    // this.rc.uiRouter.rootNavigate(ComponentRoute.LandingProxy)
  }

}
