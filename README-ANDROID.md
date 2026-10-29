# OrdenaPro para Android — proyecto de compilación gratuita

Este proyecto envuelve la aplicación web local en una app Android básica. Incluye un puente nativo para solicitar dictado en español al servicio de voz instalado en Android, con preferencia por reconocimiento sin conexión. **Que funcione sin Internet depende de que el móvil tenga un paquete/servicio de voz offline compatible; no se puede garantizar en todos los dispositivos.**

## Qué hace esta versión
- Abre la app desde los archivos incluidos, sin necesitar una web externa.
- Guarda órdenes en el almacenamiento local del WebView.
- Permite editar, buscar, imprimir/exportar CSV y hacer copias JSON.
- Solicita permiso de micrófono para el dictado nativo.

## Limitación importante
Esta compilación aún no sincroniza datos entre los móviles de los técnicos y la oficina. Cada dispositivo mantiene sus propias órdenes. La sincronización compartida será una fase posterior.

## Cómo obtener el APK gratis usando GitHub Actions
1. Crea una cuenta gratuita en GitHub si no tienes una.
2. Crea un repositorio nuevo llamado `OrdenaPro`.
3. Sube el contenido de esta carpeta al repositorio (incluida la carpeta oculta `.github`). No subas datos reales de clientes.
4. Abre la pestaña **Actions** del repositorio y activa los workflows si GitHub te lo pide.
5. Entra en **Construir APK de OrdenaPro**, pulsa **Run workflow** y espera a que termine en verde.
6. Abre la ejecución completada y descarga el artefacto `OrdenaPro-debug-apk`. Dentro estará `app-debug.apk`.
7. Envía el APK a tu móvil, ábrelo y autoriza la instalación desde esa fuente cuando Android lo solicite. Instala solo el APK que hayas generado desde tu repositorio.

La compilación usa los minutos gratuitos disponibles de GitHub Actions, sujetos a los límites de la cuenta. El APK debug sirve para pruebas; no es una versión publicada en Google Play.

## Compilar con Android Studio
Abre la carpeta del proyecto en Android Studio y deja que descargue el Android Gradle Plugin y el SDK que solicite. Después usa **Build > Build APK(s)**. Se necesita Internet durante la configuración inicial y espacio suficiente en el ordenador.
