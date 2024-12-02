import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { addresses, abis } from "../contracts";
import { ArrowsRightLeftIcon, CheckCircleIcon, XCircleIcon, DocumentMagnifyingGlassIcon, FingerPrintIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline';
import { create } from "kubo-rpc-client"; // Cliente IPFS

// Proveedor de Ethereum
const defaultProvider = new ethers.providers.Web3Provider(window.ethereum);

// Instancia del contrato en Ethereum
const propietarioContract = new ethers.Contract(
  addresses.ipfs,
  abis.ipfs,
  defaultProvider
);

function RecursosPropietario({ closeModal, selectedFile }) {

  const { tokenId } = selectedFile;
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

  const functionalities = [
    { title: "Transferir propiedad", action: () => setActiveOption("transferir"), icon: <ArrowsRightLeftIcon className="w-8 h-8" /> },
    { title: "Proporcionar acceso", action: () => setActiveOption("acceso"), icon: <CheckCircleIcon className="w-8 h-8" /> },
    { title: "Revocar acceso", action: () => setActiveOption("revocar"), icon: <XCircleIcon className="w-8 h-8" /> },
    { title: "Consultar certificado", action: () => setActiveOption("consultar"), icon: <DocumentMagnifyingGlassIcon className="w-8 h-8" /> },
    { title: "Auditar archivo", action: () => setActiveOption("auditar"), icon: <FingerPrintIcon className="w-8 h-8" /> },
    { title: "Dar licencia temporal", action: () => setActiveOption("licencia"), icon: <ClockIcon className="w-8 h-8" /> },
    { title: "Listar accesos permitidos", action: () => setActiveOption("listaraccesos"), icon: <ClockIcon className="w-8 h-8" /> },
    { title: "Eliminar archivo", action: () => setActiveOption("eliminar"), icon: <TrashIcon className="w-8 h-8" /> },
  ];

  // Función para escuchar el evento "ArchivoEliminado"
  useEffect(() => {
    const listenToArchivoEliminado = () => {
      propietarioContract.on("ArchivoEliminado", async (hash_ipfs, tokenId) => {
        console.log("Evento 'ArchivoEliminado' detectado.");
        try {
          console.log("Intentando eliminar archivo con CID:", hash_ipfs);
          await eliminarArchivoDeIPFS(hash_ipfs); // Eliminar archivo de IPFS
          alert("Archivo eliminado de IPFS.");
        } catch (error) {
          console.error("Error al eliminar archivo de IPFS:", error.message);
          setErrorMessage("No se pudo eliminar el archivo de IPFS.");
        }
      });
    };

    listenToArchivoEliminado();

    // Limpiar el listener cuando el componente se desmonte
    return () => {
      propietarioContract.removeListener("ArchivoEliminado", listenToArchivoEliminado);
    };
  }, []);

  // Función para eliminar archivo de IPFS
  const eliminarArchivoDeIPFS = async (cid) => {
    try {
      const client = create("/ip4/127.0.0.1/tcp/5002"); // Conexión IPFS local
      console.log("Intentando eliminar archivo con CID:", cid);

      // Obtener la lista de archivos anclados (AsyncGenerator)
      const pinListGenerator = await client.pin.ls();

      let found = false;

      // Iterar sobre los resultados del generador y eliminar los archivos recursivos e indirectos
      for await (let pin of pinListGenerator) {
        console.log("Archivo anclado:", pin);
        if (pin.cid === cid || pin.cid === cid) {
          // Eliminar el archivo anclado (ya sea recursivo o indirecto)
          await client.pin.rm(pin.cid, { recursive: true }); // Desanclaje recursivo
          console.log(`Archivo con CID ${pin.cid} eliminado de IPFS local.`);
          found = true;
        }
      }

      if (!found) {
        console.log(`El archivo con CID ${cid} no está anclado.`);
      }

    } catch (error) {
      console.error("Error al eliminar archivo de IPFS:", error.message);
      setErrorMessage("No se pudo eliminar el archivo de IPFS.");
    }
  };

  // Función para eliminar el archivo
  const eliminarArchivo = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      const signer = defaultProvider.getSigner();
      const contratoConSigner = propietarioContract.connect(signer);
      const tx = await contratoConSigner.eliminarArchivo(tokenId);
      await tx.wait();

      alert("Archivo eliminado del contrato. Eliminando de IPFS...");

      // Aquí no es necesario obtener el hash del archivo explícitamente porque lo estamos obteniendo del evento
      closeModal(); // Cerrar el modal después de completar la eliminación
    } catch (error) {
      console.error("Error al eliminar el archivo:", error.message);
      setErrorMessage("Error al eliminar el archivo. Asegúrate de ser el propietario.");
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

      const esValido = await contratoConSigner.fileAudit(signer.getAddress(), hashActual);

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


  const renderOptionContent = () => {
    switch (activeOption) {
      case "eliminar":
        return (
          <>
            <h3 className="text-lg font-semibold">¿Estás seguro de que deseas eliminar este archivo?</h3>
            <form onSubmit={eliminarArchivo}>
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
      case "acceso":
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
