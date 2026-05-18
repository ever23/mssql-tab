# mssql-tab AI Skill (Gestor de Base de Datos)

Esta skill define las instrucciones y patrones de uso recomendados para la librería **mssql-tab** de Microsoft SQL Server. Utiliza estos principios para que cualquier agente de IA gestione la persistencia de datos de manera eficiente, segura y consistente en el dialecto T-SQL.

## 1. Inicialización y Registro de Modelos

```javascript
const mssqlTab = require('mssql-tab');
const path = require('path');

// 1. Conexión
const db = new mssqlTab({
    server: 'localhost', // IMPORTANTE: En SQL Server usa `server` en vez de `host` (aunque es retrocompatible)
    user: 'sa',
    password: 'password',
    database: 'mi_empresa',
    options: {
        encrypt: true,
        trustServerCertificate: true // Importante para entornos de desarrollo locales
    }
});

// 2. Carga Masiva de Modelos (Recomendado)
db.pathModels(path.join(process.cwd(), 'model'));

// 3. Obtención de una instancia de tabla
const usuarios = db.tabla('usuarios');
```

## 2. Operaciones CRUD Básicas

Siguen exactamente la misma lógica polimórfica del ecosistema `dbtabla`.

### Inserción
```javascript
await usuarios.insert({ 
    user: 'admin', 
    nombre: 'Administrador', 
    tipo: 'root' 
});
```

### Consultas Select
```javascript
// Filtro sencillo
await usuarios.select({ where: { activo: 1 } });
// Select simple por objeto paramétrico posicional
await usuarios.select(null, null, { "tipo": "admin" });
```

## 3. Patrón Active Record (Instancias Inteligentes)

Todos los objetos retornados por `select` o `selectOne` heredan los métodos de grabación.

```javascript
const user = await usuarios.selectOne("user = 'pedro'");
if (user) {
    user.puntos += 10;
    await user.update(); // Genera automáticamente T-SQL `UPDATE ... WHERE ID = ...`
}
```

## 4. Transacciones Atómicas

Las transacciones usan instancias de conexión reservadas nativas del Pool de `mssql`.

```javascript
try {
    await db.beginTransaction();
    await tabla1.insert({ ... });
    await db.commit();
} catch (e) {
    await db.rollback();
    throw e;
}
```

## 5. Directrices Críticas para la IA (AI-Guidelines)

> [!IMPORTANT]
> - **Driver y Pool**: Este adaptador maneja el *Connection Pool* internamente mediante el paquete npm `mssql`. No uses conexiones explícitas individuales o cierres la BD después de una query a menos que el software vaya a cerrarse.
> - **Auto-descubrimiento y Fallbacks:** Si al tratar de conectar o hacer query la BD arroja un error con número `4060` ("Base de datos no existe"), `mssql-tab` está instruido en conectarse forzosamente al logín general (master) y emitir un `CREATE DATABASE`. No asumas esto como un error en tu código hasta la segunda reconexión.
> - **Migraciones de dialecto:** Recuerda que para SQL Server las propiedades booleanas de los modelos JSON (`tabla-model`) se interpretan ineludiblemente como `BIT`, y el `AUTO_INCREMENT` se renderiza como `IDENTITY(1,1)`.
> - **Búsquedas Paramétricas Seguras:** Siempre prefiere usar la llave explícita en objetos cuando hay peligro de sobrecarga posicional del método `dbtabla`. Ejemplo: Usa `select({ where: { estado: 1} })`.
