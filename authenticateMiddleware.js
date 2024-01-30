// authMiddleware.js

const jwt = require('jsonwebtoken');
const secretKey = 'Gabo_0604'; // Reemplaza con tu propia clave secreta

function authenticateMiddleware(req, res, next) {
  // Obtener el token de la cabecera de autorización
  const token = req.headers.authorization;

  if (!token || !token.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado o en formato incorrecto' });
  }

  // Extraer el token de 'Bearer '
  const tokenValue = token.slice(7);

  try {
    // Verificar la autenticidad del token
    const decoded = jwt.verify(tokenValue, secretKey);

    // Adjuntar la información del usuario a la solicitud para su uso posterior si es necesario
    req.user = decoded;

    // Permitir el paso al siguiente middleware o ruta
    next();
  } catch (error) {
    console.error('Error al verificar el token:', error);
    return res.status(401).json({ error: 'Token no válido' });
  }
}

module.exports = authenticateMiddleware;
