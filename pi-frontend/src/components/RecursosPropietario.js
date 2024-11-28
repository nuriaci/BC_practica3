import React, { useState } from "react";
import { ethers } from "ethers";
import { addresses, abis } from "../contracts";
import { ArrowsRightLeftIcon, CheckCircleIcon, XCircleIcon, DocumentMagnifyingGlassIcon, FingerPrintIcon, ClockIcon } from '@heroicons/react/24/outline';

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

  const functionalities = [
    { title: "Transferir propiedad", action: () => setActiveOption("transferir"), icon: <ArrowsRightLeftIcon className="w-8 h-8" /> },
    { title: "Proporcionar acceso", action: () => setActiveOption("acceso"), icon: <CheckCircleIcon className="w-8 h-8" /> },
    { title: "Revocar acceso", action: () => setActiveOption("revocar"), icon: <XCircleIcon className="w-8 h-8" /> },
    { title: "Consultar certificado", action: () => setActiveOption("consultar"), icon: <DocumentMagnifyingGlassIcon className="w-8 h-8" /> },
    { title: "Auditar archivo", action: () => setActiveOption("auditar"), icon: <FingerPrintIcon className="w-8 h-8" /> },
    { title: "Dar licencia temporal", action: () => setActiveOption("licencia"), icon: <ClockIcon className="w-8 h-8" /> },
  ];


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

      const tx = await contratoConSigner.darLicenciaTemporal(tokenId, direccionUsuario, duration);
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

      const tx = await contratoConSigner.accesoNFT(tokenId, usuarioAcceso);
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

      const tx = await contratoConSigner.revocarAcceso(tokenId, usuarioRevocar);
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
            onClick={() => setActiveOption(null)}  // Reset to main menu
            className="absolute top-2 left-2 text-gray-200 hover:text-white text-xl transition-all"
          >
            &larr; {/* Left arrow for going back */}
          </button>
        )}
        <h2 className="text-2xl font-semibold mb-4 text-center">{activeOption ? "Detalle de opción" : "Opciones para el propietario"}</h2>
        {renderOptionContent()}
      </div>
    </div>
  );
}

export default RecursosPropietario;
