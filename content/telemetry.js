class LinkedInTelemetrySimulator {
  constructor () {
    this.queue = []
    this.isTracking = false
    this.sessionId = 'li_sess_' + Math.random().toString(36).substring(2, 15)
    this.sequenceId = 1
    this.timer = null
  }

  start () {
    if (this.isTracking) return
    this.isTracking = true

    this.timer = setInterval(() => {
      this.flushQueue()
    }, 4500 + Math.random() * 3000)
  }

  stop () {
    this.isTracking = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.flushQueue(true)
  }

  trackMicroEvent (eventType, targetElement, extraData = {}) {
    if (!this.isTracking) return

    let targetTag = 'DIV'
    let componentType = 'unknown'

    if (targetElement) {
      targetTag = targetElement.tagName || 'DIV'
      componentType =
        targetElement.getAttribute('data-enskap-component') ||
        targetElement.getAttribute('data-component-type') ||
        targetElement.className ||
        'standard-ui'
    }

    const payload = {
      pId: this.sessionId,
      seq: this.sequenceId++,
      et: eventType,
      tag: targetTag,
      comp:
        typeof componentType === 'string'
          ? componentType.substring(0, 50)
          : 'complex',
      ts: Date.now(),
      viewport: {
        w: window.innerWidth,
        h: window.innerHeight
      },
      ...extraData
    }

    this.queue.push(payload)

    if (this.queue.length >= 15) {
      this.flushQueue()
    }
  }

  flushQueue (isSync = false) {
    if (this.queue.length === 0) return

    const batchToSend = [...this.queue]
    this.queue = []

    const bodyData = JSON.stringify({
      events: batchToSend,
      clientVersion: '1.9.' + Math.floor(Math.random() * 500),
      navigatorLang: navigator.language || 'en-US'
    })

    try {
      if (isSync && navigator.sendBeacon) {
        navigator.sendBeacon(
          'https://www.linkedin.com/li/track?action=client_event_batch',
          bodyData
        )
      } else if (navigator.sendBeacon) {
        navigator.sendBeacon(
          'https://www.linkedin.com/li/track?action=client_event',
          bodyData
        )
      } else {
        fetch('https://www.linkedin.com/li/track?action=client_event', {
          method: 'POST',
          body: bodyData,
          keepalive: true,
          headers: { 'Content-Type': 'application/json' }
        }).catch(() => {})
      }
    } catch (err) {}
  }
}

if (typeof window !== 'undefined') {
  if (!window.liTelemetry) {
    const telemetry = new LinkedInTelemetrySimulator()
    telemetry.start()
    window.liTelemetry = telemetry

    console.log(
      '%c[INFO]%c Extension telemetry successfully activated.',
      'color: #00e676; font-weight: bold;',
      'color: inherit;'
    )

    window.addEventListener('LI_TELEMETRY_ACTION', e => {
      const { action, eventType, extraData } = e.detail || {}
      if (action === 'track') {
        telemetry.trackMicroEvent(eventType, document.body, extraData)
      } else if (action === 'flush') {
        telemetry.flushQueue(true)
      }
    })
  }
}
