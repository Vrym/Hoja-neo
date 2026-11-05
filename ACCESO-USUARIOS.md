# Acceso de Hoja Neo: usuarios y contraseñas

La pantalla de Hoja Neo pide un **nombre de usuario** y una **contraseña**. Los jugadores no necesitan una dirección de correo real.

## Cómo funciona

Firebase Authentication utiliza internamente el proveedor Email/Password. Para no pedir correos personales, Hoja Neo transforma cada nombre de usuario en un alias técnico con el dominio reservado `hojaneo-c7718.firebaseapp.com`. Ese alias no es una casilla de correo y no se usa para enviar mensajes.

La correspondencia es fija: por ejemplo, el usuario `facu` inicia sesión internamente como `facu@hojaneo-c7718.firebaseapp.com`. En la pantalla y en la sesión se muestra solamente el nombre de usuario.

## Crear las cinco cuentas

En Firebase Console → Authentication → Users → Add user, crear:

| Usuario que escribirá | Alias técnico que se carga en Firebase | Rol |
|---|---|---|
| `admin` | `admin@hojaneo-c7718.firebaseapp.com` | `admin` |
| `facu` | `facu@hojaneo-c7718.firebaseapp.com` | `gm` |
| `seba` | `seba@hojaneo-c7718.firebaseapp.com` | `player` |
| `mica` | `mica@hojaneo-c7718.firebaseapp.com` | `player` |
| `ivan` | `ivan@hojaneo-c7718.firebaseapp.com` | `player` |

Asignar una contraseña segura y distinta a cada cuenta. No guardar contraseñas en Realtime Database ni compartirlas en el repositorio.

## Asignar los roles

Después de crear cada usuario, copiar su UID desde Authentication → Users. En Realtime Database, crear:

```
neo
  roles
    UID_DE_ADMIN
      username: "admin"
      role: "admin"
    UID_DE_FACU
      username: "facu"
      role: "gm"
    UID_DE_SEBA
      username: "seba"
      role: "player"
    UID_DE_MICA
      username: "mica"
      role: "player"
    UID_DE_IVAN
      username: "ivan"
      role: "player"
```

Cada nodo debe estar bajo `neo/roles`, con el UID real correspondiente. No usar literalmente los textos `UID_DE_...`.

**Importante:** las reglas de Realtime Database impiden que los usuarios se asignen o cambien sus propios roles. El propietario del proyecto debe cargar estos valores desde Firebase Console. Publicar también las reglas de `firebase-database.rules.json` en Realtime Database → Rules.

## Nombre de usuario permitido

Entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo. El acceso no distingue mayúsculas de minúsculas. La contraseña sí distingue mayúsculas y minúsculas.

## Nota sobre recuperación de contraseña

Como no hay una casilla de correo real, el restablecimiento por email no está disponible. Si alguien olvida su contraseña, el administrador del proyecto deberá restablecerla desde Firebase Authentication.
