import React, { useState } from "react";
import { create } from "kubo-rpc-client"; // Cliente IPFS de Kubo
import { ethers } from "ethers";
import { Buffer } from "buffer";
import { addresses, abis } from "../contracts"; // Contratos
import { toast } from 'react-toastify'; // Importar la función de Toastify
import 'react-toastify/dist/ReactToastify.css'; // Importar los estilos de Toastify

// Proveedor de Ethereum
const defaultProvider = new ethers.providers.Web3Provider(window.ethereum);

// Instancia del contrato en Ethereum
const registroContract = new ethers.Contract(
  addresses.ipfs, // Dirección del contrato de registro
  abis.ipfs,      // ABI del contrato de registro
  defaultProvider
);

function UploadFile({ closeModal }) {
  const [file, setFile] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [ipfsHash, setIpfsHash] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Leer y convertir el archivo seleccionado
  const retrieveFile = (e) => {
    const data = e.target.files[0];

    if (data && data instanceof Blob) {
      const reader = new window.FileReader();

      reader.onloadend = () => {
        setFile(Buffer(reader.result)); // Convertir el archivo en Buffer para IPFS
      };

      reader.readAsArrayBuffer(data);
    } else {
      toast.error("Por favor selecciona un archivo válido."); // Mostrar error en Toastify
    }
    e.preventDefault();
  };

  // Comprobar si MetaMask está conectada o solicitar permiso
  const checkMetaMaskConnection = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask no está instalada.");
      }

      // Solicitar conexión a MetaMask
      const accounts = await window.ethereum.enable();
      if (accounts.length === 0) {
        throw new Error("MetaMask no está conectada.");
      }

      return accounts[0]; // Devuelve la dirección de la cuenta conectada
    } catch (error) {
      throw new Error(error.message);
    }
  };



  // Subir archivo a IPFS y registrarlo en Ethereum
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file || !titulo || !descripcion) {
      toast.error("Por favor completa todos los campos."); // Notificación de error
      return;
    }

    setIsUploading(true);
    setErrorMessage(""); // Reiniciar mensajes de error

    try {
      // Verificar conexión a MetaMask o solicitar permiso
      const account = await checkMetaMaskConnection();
      console.log(`Conectado a MetaMask con la cuenta: ${account}`);

      // Cliente IPFS (conexión a tu nodo local)
      const client = await create("/ip4/127.0.0.1/tcp/5002"); // Conexión IPFS local

      const result = await client.add(file);

      try {
        await client.files.cp(`/ipfs/${result.cid}`, `/${result.cid}`);
      } catch (error) {
        if (error.message && error.message.includes('directory already has entry by that name')) {
          setErrorMessage('El archivo ya está registrado en IPFS.'); // Actualizamos el estado con el error específico
          throw new Error('El archivo ya está registrado en IPFS.'); // Lanzar un error personalizado
        } else {
          setErrorMessage('Hubo un problema al registrar el archivo en IPFS.');
          throw error;
        }
      }

      // Registrar el archivo en el contrato de Ethereum
      const signer = defaultProvider.getSigner();
      const contratoConSigner = registroContract.connect(signer);
      const tx = await contratoConSigner.registro(
        result.cid.toString(), // Hash del archivo IPFS
        titulo,                 // Título del archivo
        descripcion            // Descripción del archivo
      );
      await tx.wait(); // Esperar confirmación de la transacción
      setIpfsHash(result.cid.toString());
      toast.success(`Archivo subido y registrado con éxito: ${result.cid.toString()}`); // Notificación de éxito
      closeModal(); // Cerrar el modal después de subir el archivo
    } catch (error) {
      console.error("Error al subir el archivo:", error.message);
      toast.error("Hubo un problema al procesar tu solicitud. Inténtalo nuevamente."); // Notificación de error
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-blue-gray-900 text-white rounded-lg shadow-lg p-8 w-96 relative">
        <button
          onClick={closeModal}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-lg"
        >
          &times;
        </button>
        <h2 className="text-2xl font-light mb-4">Registrar archivo</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="file"
            className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-500 file:text-white hover:file:bg-teal-600"
            onChange={retrieveFile}
          />
          <input
            type="text"
            placeholder="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="block w-full text-sm bg-gray-800 text-white p-2 mt-4 rounded"
            required
          />
          <textarea
            placeholder="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="block w-full text-sm bg-gray-800 text-white p-2 mt-2 rounded"
            required
          />
          <button
            type="submit"
            className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
          >
            {isUploading ? "Subiendo..." : "Registrar"}
          </button>
        </form>

        {/* Mensajes de éxito y error */}
        {ipfsHash && (
          <p className="mt-4 text-green-600">
            Archivo subido con éxito:{" "}
            <a
              href={`https://webui.ipfs.io/#/files/${ipfsHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-500"
            >
              {ipfsHash}
            </a>
          </p>
        )}
        {errorMessage && <p className="mt-4 text-red-600">{errorMessage}</p>}
      </div>
    </div>
  );
}

export default UploadFile;