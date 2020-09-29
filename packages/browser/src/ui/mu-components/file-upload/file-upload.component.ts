import { Component, 
         OnInit, 
         Inject, 
         Input,
         ViewChild,
         ElementRef,
         Output,
         EventEmitter
       }                          from '@angular/core'
import { TrackableScreen }        from '../../../ui/router/trackable-screen'
import { TranslateService }       from '../translate'

export const PERMISSION = {
  CAMERA  : 'CAMERA'
}


export interface UploadedDocParams {
 base64   : string
 checksum : string
 mimeType : string
}

@Component({
  selector    : 'file-upload',
  templateUrl : './file-upload.component.html',
  styleUrls   : ['./file-upload.component.scss']
})

export class FileUploadComponent implements OnInit {

  @ViewChild('uploadFileCont') uploadFileCont : ElementRef

  @Input() screen         : TrackableScreen
  @Input() eventPropagate : boolean
  @Input() isRequired     : boolean

  @Output() value         : EventEmitter<UploadedDocParams> = new EventEmitter<UploadedDocParams>()

  uploadedDocParams     : UploadedDocParams

  /*rc type is any since it is of type RuncontextApp and it is app specific
    and should not be imported here
  */
  constructor(@Inject('RunContext') public rc : any,
              private translate               : TranslateService) { }

  ngOnInit() {
  }

  ngAfterViewInit() {

    if (this.rc.bridge.isRunningInBrowser()) {
      if(this.uploadFileCont)
        this.uploadFileCont.nativeElement.addEventListener('change', this.onFileUpload.bind(this))
    }
  }

  /*=====================================================================
                              PRIVATE
  =====================================================================*/
  private async onFileUpload(event: any) {

    const file = event.target.files[0]

    if (!file.type.includes('image')) {
      const errorText = this.translate.instant('upl_invalid_mime_type')
      this.rc.uiRouter.showToast(errorText)
      return
    }

    if (file.size > 512000) {
      const warnText = this.translate.instant('upl_max_size_err')
      this.rc.uiRouter.showToast(warnText)
      return
    }

    const base64 = await this.rc.utils.getBase64(file) as string,
      strippedBase64 = base64.replace(`data:${file.type};base64,`, '')

    const uploadDoc: UploadedDocParams = {
      base64: strippedBase64,
      mimeType: file.type,
      checksum: await this.rc.utils.getCheckSum(strippedBase64)
    }

    if (!this.uploadedDocParams) this.uploadedDocParams = {} as UploadedDocParams
    this.uploadedDocParams = uploadDoc

    this.uploadFileCont.nativeElement.value = null

  }

  private async updatePicture() {

    const resp = await this.rc.bridge.takePictureFromCamera()

    if (!resp['success']) {
      this.rc.uiRouter.showToast(this.translate.instant('mu_fil_upl_unknow_err'))
      return
    }

    const uploadDoc: UploadedDocParams = {
      base64    : resp['base64'],
      mimeType  : resp['mimeType'],
      checksum  : await this.rc.utils.getCheckSum(resp['base64'])
    }

    if (!this.uploadedDocParams) this.uploadedDocParams = {} as UploadedDocParams
    this.uploadedDocParams = uploadDoc
    
    if (this.eventPropagate) {
      this.onSubmit()
    }

  }

  /*=====================================================================
                              HTML
  =====================================================================*/
  async takePicture() {
    
    if (this.rc.bridge.isRunningInBrowser()) return
    
    const resp = await this.rc.bridge.getPermission(PERMISSION.CAMERA,false)
    if (!resp.permGiven) {
      return 
    }

    this.rc.bridge(PERMISSION.CAMERA).then((permResp: any) => {
      if (permResp.permGiven) this.updatePicture()
    })
  }

  async uploadFile() {

    if (this.rc.bridge.isRunningInBrowser()) {
      const event = new MouseEvent('click', {bubbles: false})
      this.uploadFileCont.nativeElement.dispatchEvent(event)
      return
    }

    const docObj  = await this.rc.bridge.selectDocumentFile()

    if (docObj['error']) return

    if (!docObj['base64']) {
      this.rc.uiRouter.showToast(this.translate.instant('cmn_toast_err_unknown'))
      return
    }

    const uploadDoc  = {
      base64    : docObj['base64'],
      checksum  : docObj['checksum'],
      mimeType  : docObj['mimeType']
    }

    if (!this.uploadedDocParams) this.uploadedDocParams = {} as UploadedDocParams
    this.uploadedDocParams= uploadDoc

    if (this.eventPropagate) {
      this.onSubmit()
    }

  }
  
  onSubmit() {
    
    if ( this.isRequired && (!this.uploadedDocParams || !Object.keys(this.uploadedDocParams).length)) {
      this.rc.uiRouter.showToast(this.translate.instant('mu_fil_upl_upload_err'))
    } else {
      this.value.emit(this.uploadedDocParams)
    }
    
  }

}
