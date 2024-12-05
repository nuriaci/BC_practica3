import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { addresses, abis } from "../contracts";
import { ArrowsRightLeftIcon, CheckCircleIcon, XCircleIcon, DocumentMagnifyingGlassIcon, FingerPrintIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline';
import CryptoJS from 'crypto-js';
import { Buffer } from "buffer";
import axios from "axios";

const wordArrayToUint8Array = (wordArray) => {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xFF;
  }
  return u8;
};
// Proveedor de Ethereum
const defaultProvider = new ethers.providers.Web3Provider(window.ethereum);
const pinataApiKey = "3bb728609cd7a7a930d4"
const pinata_secret_api_key = "99057346cbb24d947c1cf6f2443bd7ad49231a2076dbf335f43a84fbe4846c91"

const propietarioContract = new ethers.Contract(
  addresses.ipfs,
  abis.ipfs,
  defaultProvider
);

function RecursosPropietario({ closeModal, selectedFile }) {

  const { hash, direccionPropietario, tokenId } = selectedFile;
  const [activeOption, setActiveOption] = useState(null);
  const [nuevoPropietario, setNuevoPropietario] = useState("");
  // const [tokenId, setTokenId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  /*Dar licencia temporal */
  const [direccionUsuario, setDireccionUsuario] = useState("");
  const [duration, setDuration] = useState("");
  /* Proporcionar acceso */
  const [usuarioAcceso, setUsuarioAcceso] = useState("");
  /* Revocar acceso */
  const [usuarioRevocar, setUsuarioRevocar] = useState("");
  /* Auditar archivo */
  const [hashActual, setHashActual] = useState("");
  /* Consultar certificado */
  const [hashActualCertificado, sethashActualCertificado] = useState("");
  const [certificado, setCertificado] = useState(null);
  /* Listar accesos a archivo */
  const [accesosPermitidos, setAccesosPermitidos] = useState([]);
  /* Acceder a archivo */
  const [archivoDescifrado, setArchivoDescifrado] = useState(null);


  const functionalities = [
    { title: "Transferir propiedad", action: () => setActiveOption("transferir"), icon: <ArrowsRightLeftIcon className="w-8 h-8" /> },
    { title: "Proporcionar acceso", action: () => setActiveOption("proporcionaracceso"), icon: <CheckCircleIcon className="w-8 h-8" /> },
    { title: "Revocar acceso", action: () => setActiveOption("revocar"), icon: <XCircleIcon className="w-8 h-8" /> },
    { title: "Consultar certificado", action: () => setActiveOption("consultar"), icon: <DocumentMagnifyingGlassIcon className="w-8 h-8" /> },
    { title: "Auditar archivo", action: () => setActiveOption("auditar"), icon: <FingerPrintIcon className="w-8 h-8" /> },
    { title: "Dar licencia temporal", action: () => setActiveOption("licencia"), icon: <ClockIcon className="w-8 h-8" /> },
    { title: "Listar accesos permitidos", action: () => setActiveOption("listaraccesos"), icon: <ClockIcon className="w-8 h-8" /> },
    { title: "Eliminar archivo", action: () => setActiveOption("eliminar"), icon: <TrashIcon className="w-8 h-8" /> },
    { title: "Acceder a archivo", action: () => setActiveOption("acceso"), icon: <TrashIcon className="w-8 h-8" /> },
  ];

  const unpinFile = async () => {
    try {

      const options = {
        method: 'DELETE', headers: {
          'pinata_api_key': '3bb728609cd7a7a930d4',
          'pinata_secret_api_key': '99057346cbb24d947c1cf6f2443bd7ad49231a2076dbf335f43a84fbe4846c91'
        }
      }
      // Realiza la solicitud para desanclar el archivo
      const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${hash}`, options);


      if (!response.ok) {
        throw new Error('Error al desanclar archivo');
      }
      console.log(`Archivo con CID ${tokenId} desanclado exitosamente de Pinata.`);

      // Después de desanclar el archivo de Pinata, elimina el archivo del contrato.
      await eliminarArchivo();
    } catch (error) {
      console.error('Error al desanclar archivo:', error);
    }
  };

  // Función para eliminar el archivo
  const eliminarArchivo = async () => {
    try {
      const signer = defaultProvider.getSigner();
      const contratoConSigner = propietarioContract.connect(signer);

      // Llamada a la función de contrato para eliminar el archivo
      const tx = await contratoConSigner.eliminarArchivo(tokenId);
      await tx.wait();

      console.log("Archivo eliminado del contrato con CID:", tokenId);
    } catch (error) {
      console.error('Error al eliminar archivo del contrato:', error);
    }
  };


  /* Listar accesos */
  const listarAccesos = async () => {
    try {
      const signer = defaultProvider.getSigner();
      const contratoConSigner = propietarioContract.connect(signer);
      const accesos = await contratoConSigner.listarClaimsArchivo(tokenId);
      const listaAccesos = await accesos.wait()
      // Ahora buscamos el evento 'AccesosListados' dentro de los logs de la transacción
      const event = listaAccesos.events?.find(event => event.event === "AccesosListados");

      // Si encontramos el evento, extraemos los claims
      if (event && event.args) {
        const accesos = event.args.claims;

        // Formatear los datos devueltos
        const accesosFormateados = accesos.map(claim => ({
          usuario: claim.usuario, // Dirección del usuario
          acceso: claim.acceso,   // Booleano indicando si tiene acceso
          duracion: claim.duracion.toString(), // Convertir BigNumber a string
          fecha: claim.fecha.toString() // Si tiene un campo de fecha (BigNumber) convertirlo
        }));

        // Filtrar los accesos válidos
        const accesosConAcceso = accesosFormateados.filter(claim => claim.acceso === true);

        // Actualizar el estado con los accesos permitidos
        setAccesosPermitidos(accesosConAcceso);
      }
    } catch (error) {
      console.error("Error al listar los accesos:", error.message);
      setErrorMessage("Error al obtener la lista de accesos.");
    }
  }

  /*Transferir propiedad */
  const transferirPropiedad = async (e) => {
    e.preventDefault();
    console.log(hash);
    if (!nuevoPropietario || !ethers.utils.isAddress(nuevoPropietario)) {
      setErrorMessage("La dirección proporcionada no es válida.");
      return;
    }

    setErrorMessage("");
    try {
      const signer = defaultProvider.getSigner();
      const contratoConSigner = propietarioContract.connect(signer);

      const tx = await contratoConSigner.transferProperty(
        nuevoPropietario,
        tokenId
      );
      await tx.wait();


    } catch (error) {
      console.error("Error al transferir la propiedad:", error.message);
    }
  }

  /*Dar Licencia temporal */
  const darLicenciaTemporal = async (e) => {
    e.preventDefault();

    if (!direccionUsuario || !duration) {
      setErrorMessage("Por favor, complete todos los campos.");
      return;
    }

    setErrorMessage("");
    try {
      const signer = defaultProvider.getSigner();
      const contratoConSigner = propietarioContract.connect(signer);
      const duracionEnDias = duration * 86400;
      const tx = await contratoConSigner.darLicenciaTemporal(tokenId, direccionUsuario, duracionEnDias);
      await tx.wait();

      alert("Licencia temporal otorgada con éxito");
    } catch (error) {
      console.error("Error al dar la licencia temporal:", error.message);
      setErrorMessage("Error al dar la licencia temporal");
    }
  };
  /* Proporcionar acceso */
  const proporcionarAcceso = async (e) => {
    e.preventDefault();
    console.log(usuarioAcceso);
    if (!usuarioAcceso) {
      setErrorMessage("Por favor, complete todos los campos.");
      return;
    }
    if (!ethers.utils.isAddress(usuarioAcceso)) {
      setErrorMessage("La dirección proporcionada no es válida.");
      return;
    }

    setErrorMessage("");
    try {
      const signer = defaultProvider.getSigner();
      const contratoConSigner = propietarioContract.connect(signer);

      const tx = await contratoConSigner.concederAcceso(usuarioAcceso, tokenId);
      await tx.wait();

      alert("Acceso otorgado con éxito");
    } catch (error) {
      console.error("Error al proporcionar acceso:", error.message);
      setErrorMessage("Error al proporcionar acceso");
    }
  };

  /* Revocar acceso */
  const revocarAcceso = async (e) => {
    e.preventDefault();
    console.log(usuarioRevocar);

    if (!usuarioRevocar) {
      setErrorMessage("Por favor, complete todos los campos.");
      return;
    }
    if (!ethers.utils.isAddress(usuarioRevocar)) {
      setErrorMessage("La dirección proporcionada no es válida.");
      return;
    }

    setErrorMessage("");
    try {
      const signer = defaultProvider.getSigner();
      const contratoConSigner = propietarioContract.connect(signer);

      const tx = await contratoConSigner.revocacionClaims(usuarioRevocar, tokenId);
      await tx.wait();

      alert("Acceso revocado con éxito");
    } catch (error) {
      console.error("Error al revocar el acceso:", error.message);
      setErrorMessage("Error al revocar el acceso");
    }
  };

  /* Auditar archivo */
  const auditarArchivo = async (e) => {
    e.preventDefault();

    if (!hashActual) {
      setErrorMessage("Por favor, complete todos los campos.");
      return;
    }

    setErrorMessage("");
    try {
      const signer = defaultProvider.getSigner();
      const contratoConSigner = propietarioContract.connect(signer);

      const esValido = await contratoConSigner.fileAudit(tokenId, hashActual);

      if (esValido) {
        alert("El archivo es válido, no ha sido modificado.");
      } else {
        alert("El archivo ha sido modificado.");
      }
    } catch (error) {
      console.error("Error al auditar el archivo:", error.message);
      setErrorMessage("Error al auditar el archivo");
    }
  };

  /* Consultar certificado */
  const consultarCertificado = async (e) => {
    e.preventDefault();

    if (!hashActualCertificado) {
      setErrorMessage("Por favor, ingrese el hash del archivo.");
      return;
    }

    setErrorMessage("");
    try {
      const signer = defaultProvider.getSigner();
      const contratoConSigner = propietarioContract.connect(signer);

      // Llamada al contrato para obtener los detalles del certificado
      const [titulo, descripcion, hash, tiempo] = await contratoConSigner.registryCertificate(signer.getAddress(), hashActualCertificado);

      // Guardamos los detalles en el estado
      setCertificado({ titulo, descripcion, hash, tiempo });
    } catch (error) {
      console.error("Error al consultar el certificado:", error.message);
      setErrorMessage("Error al consultar el certificado. Asegúrate de que el hash sea válido.");
    }
  };

  const accederArchivo = async (e) => {

    e.preventDefault()
    let archivo = "";
    let blobDescifrado = "";
    let claveDescifrada = "";
    let iv = "";
    let mimeType = "";
    let response = "";
    const signer = defaultProvider.getSigner();
    const userAddress = await signer.getAddress();
    const contratoConSigner = propietarioContract.connect(signer);

    try {
      // Obtenemos la clave de descifrado
      claveDescifrada = await contratoConSigner.obtenerClave(tokenId, userAddress);

      // Obtenemos el IV
      iv = await propietarioContract.obtenerIV(tokenId);

      response = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`, {
        method: 'GET'
      });
      // Verificar que la respuesta sea exitosa
      if (!response.ok) {
        throw new Error('Error al obtener el archivo desde Piñata.');
      }

      // Convertir la respuesta a un Blob (contenido binario)
      archivo = await response.blob();
      console.log(archivo)

      // Obtenemos el mimeType
      mimeType = await contratoConSigner.obtenerTipoMime(direccionPropietario, tokenId);

      // Eliminar prefijos '0x' si existen
      const claveSinPrefijo = claveDescifrada.startsWith("0x") ? claveDescifrada.slice(2) : claveDescifrada;
      const ivSinPrefijo = iv.startsWith("0x") ? iv.slice(2) : iv;

      // Convertir clave e IV a WordArray
      const keyWordArray = CryptoJS.enc.Hex.parse(claveSinPrefijo);
      const ivWordArray = CryptoJS.enc.Hex.parse(ivSinPrefijo);

      // Convertir archivo cifrado (Buffer) a WordArray
      const archivoCifradoUint8Array = new Uint8Array(await archivo.arrayBuffer());
      const ciphertextWordArray = CryptoJS.lib.WordArray.create(archivoCifradoUint8Array);

      // Crear CipherParams para CryptoJS
      const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ciphertextWordArray });

      // Descifrar usando AES-CBC
      const decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, {
        iv: ivWordArray,
        padding: CryptoJS.pad.Pkcs7, // Asegurarse de usar el mismo padding que en el cifrado
      });

      const decryptedBytes = wordArrayToUint8Array(decrypted)

      // Crear un Blob con el contenido descifrado y el tipo MIME
      blobDescifrado = new Blob([decryptedBytes], { type: mimeType });

    } catch (error) {
      console.error("Error en el proceso de descifrado", error.message);
      setErrorMessage("No se ha podido descifrar el archivo.");
      return null;
    }

    if (blobDescifrado) {
      setArchivoDescifrado(blobDescifrado);
    } else {
      setErrorMessage("Error al descifrar el archivo.");
    }
  }

  const renderOptionContent = () => {
    switch (activeOption) {
      case "eliminar":
        return (
          <>
            <h3 className="text-lg font-semibold">¿Estás seguro de que deseas eliminar este archivo?</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                unpinFile();
              }}
            >
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white mt-4 py-2 px-4 rounded w-full"
              >
                Confirmar eliminación
              </button>
              {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
            </form>
          </>
        );
      case "transferir":
        return (<>
          <form onSubmit={transferirPropiedad}>
            <input
              type="text"
              placeholder="Dirección del nuevo propietario"
              value={nuevoPropietario}
              onChange={(e) => setNuevoPropietario(e.target.value)}
              className="block w-full text-sm bg-gray-800 text-white p-2 mt-4 rounded"
              required />
            <button
              type="submit"
              className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
            >
              {"Transferir propiedad"}
            </button>
            {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
          </form></>);
      case "proporcionaracceso":
        return (
          <>
            <form onSubmit={proporcionarAcceso}>
              <input
                type="text"
                placeholder="Dirección del usuario"
                value={usuarioAcceso}
                onChange={(e) => setUsuarioAcceso(e.target.value)}
                className="block w-full text-sm bg-gray-800 text-white p-2 mt-2 rounded"
                required
              />
              <button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
              >
                Proporcionar acceso
              </button>
              {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
            </form>
          </>
        );
      case "revocar":
        return (
          <>
            <form onSubmit={revocarAcceso}>
              <input
                type="text"
                placeholder="Dirección del usuario"
                value={usuarioRevocar}
                onChange={(e) => setUsuarioRevocar(e.target.value)}
                className="block w-full text-sm bg-gray-800 text-white p-2 mt-2 rounded"
                required
              />
              <button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
              >
                Revocar acceso
              </button>
              {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
            </form>
          </>
        );
      case "consultar":
        return (
          <>
            <form onSubmit={consultarCertificado}>
              <input
                type="text"
                placeholder="Hash del archivo"
                value={hashActualCertificado}
                onChange={(e) => sethashActualCertificado(e.target.value)}
                className="block w-full text-sm bg-gray-800 text-white p-2 mt-4 rounded"
                required
              />
              <button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
              >
                Consultar certificado
              </button>
            </form>
            {certificado && (
              <div className="mt-6 text-white">
                <h3 className="text-lg font-semibold">Detalles del Certificado</h3>
                <p><strong>Título:</strong> {certificado.titulo}</p>
                <p><strong>Descripción:</strong> {certificado.descripcion}</p>
                <p><strong>Hash:</strong> {certificado.hash}</p>
                <p><strong>Tiempo:</strong> {new Date(certificado.tiempo * 1000).toLocaleString()}</p>
              </div>
            )}
            {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
          </>
        );
      case "auditar":
        return (
          <>
            <form onSubmit={auditarArchivo}>
              <input
                type="text"
                placeholder="Hash actual del archivo"
                value={hashActual}
                onChange={(e) => setHashActual(e.target.value)}
                className="block w-full text-sm bg-gray-800 text-white p-2 mt-2 rounded"
                required
              />
              <button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
              >
                Auditar archivo
              </button>
            </form>
          </>
        );
      case "licencia":
        return (
          <>
            <form onSubmit={darLicenciaTemporal}>
              <input
                type="text"
                placeholder="Dirección del usuario"
                value={direccionUsuario}
                onChange={(e) => setDireccionUsuario(e.target.value)}
                className="block w-full text-sm bg-gray-800 text-white p-2 mt-2 rounded"
                required
              />
              <input
                type="number"
                placeholder="Duración (en días)"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="block w-full text-sm bg-gray-800 text-white p-2 mt-2 rounded"
                required
              />
              <button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
              >
                Dar Licencia Temporal
              </button>
            </form>
          </>
        );
      case "listaraccesos":
        return (
          <>
            {accesosPermitidos.length > 0 ? (
              <div className="mt-4">
                <h3 className="font-semibold text-lg">Usuarios con acceso:</h3>
                <ul>
                  {accesosPermitidos.map((usuario, index) => (
                    <li key={index} className="text-sm text-white">
                      <p><strong>Dirección:</strong> {usuario.usuario}</p>
                      <p><strong>Fecha de acceso:</strong> {new Date(parseInt(usuario.fecha) * 1000).toLocaleString()}</p>
                      <p><strong>Duración:</strong> {usuario.duracion} días</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-red-500">{errorMessage || "No hay usuarios con acceso"}</p>
            )}
          </>
        );
      case "acceso":
        return (
          <>
            <form onSubmit={accederArchivo}>
              <button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
              >
                Acceder al Archivo
              </button>
              {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
            </form>
            {archivoDescifrado && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold">Vista Previa del Archivo</h3>
                <div className="mt-4 bg-gray-900 p-4 rounded shadow-md">
                  {archivoDescifrado.type.startsWith("image/") && (
                    <img
                      src={URL.createObjectURL(archivoDescifrado)}
                      alt="Archivo Descifrado"
                      className="w-full rounded"
                    />
                  )}
                  {archivoDescifrado.type.startsWith("application/pdf") && (
                    <embed
                      src={URL.createObjectURL(archivoDescifrado)}
                      type="application/pdf"
                      className="w-full h-96 rounded"
                    />
                  )}
                  {!archivoDescifrado.type.startsWith("image/") &&
                    !archivoDescifrado.type.startsWith("application/pdf") && (
                      <iframe
                        src={URL.createObjectURL(archivoDescifrado)}
                        className="w-full h-96 rounded"
                        title="Archivo Descifrado"
                      ></iframe>
                    )}
                </div>
              </div>
            )}
          </>
        );

      default:
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <button
              onClick={closeModal}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-lg"
            >
              &times;
            </button>
            {functionalities.map((func, index) => (
              <div
                key={index}
                onClick={func.action}
                className="flex flex-col items-center justify-center w-full h-32 bg-gradient-to-r from-teal-600 to-teal-800 rounded-lg shadow-lg text-center cursor-pointer hover:scale-105 transform transition-all duration-300"
              >
                <div className="text-3xl mb-2">{func.icon}</div>
                <h2 className="text-sm sm:text-md font-light text-white">{func.title}</h2>
              </div>
            ))}
          </div>
        );
    }
  };

  useEffect(() => {
    if (activeOption === "listaraccesos") {
      listarAccesos();
    }
  }, [activeOption]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-cover bg-center bg-opacity-70 bg-gradient-to-br text-white rounded-lg shadow-lg p-6 sm:p-8 w-full sm:w-auto max-w-lg relative transform transition-all duration-300 scale-95 hover:scale-100">
        <button
          onClick={closeModal}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-lg"
        >
          &times;
        </button>
        {activeOption && (
          <button
            onClick={() => setActiveOption(null)}  // Resetear al menú principal
            className="absolute top-2 left-2 text-gray-200 hover:text-white text-xl transition-all"
          >
            &larr; {/* Flecha para volver */}
          </button>
        )}

        <h2 className="text-2xl font-semibold mb-4 text-center">
          {activeOption ? "Detalle de opción" : "Opciones para el propietario"}
        </h2>

        {renderOptionContent()}
      </div>
    </div>

  );
}

export default RecursosPropietario;
