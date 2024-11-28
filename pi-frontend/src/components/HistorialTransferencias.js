import React, { useState } from "react";
import { ethers } from "ethers";
import { addresses, abis } from "../contracts";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Proveedor de Ethereum
const defaultProvider = new ethers.providers.Web3Provider(window.ethereum);

// Instancia del contrato en Ethereum
const transferenciaContract = new ethers.Contract(
    addresses.ipfs, // Dirección del contrato
    abis.ipfs,      // ABI del contrato
    defaultProvider
);

function HistorialTransferencias({ closeModal }) {
    const [tokenId, setTokenId] = useState("");
    const [transferencias, setTransferencias] = useState([]);
    const [isFetching, setIsFetching] = useState(false);

    // Obtener el historial de transferencias para un tokenId
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!tokenId) {
            toast.error("Por favor, introduce un tokenId válido.");
            return;
        }

        setIsFetching(true);

        try {
            const signer = defaultProvider.getSigner();
            const contratoConSigner = transferenciaContract.connect(signer);

            // Llamada al contrato para obtener el historial de transferencias
            const result = await contratoConSigner.transferHistory(tokenId);
            console.log("Transferencias devueltas:", result);

            // Verifica si no hay transferencias
            if (!result || result.length === 0) {
                toast.info(`No se encontraron transferencias para el token ${tokenId}.`);
                setTransferencias([]);
                return;
            }

            // Formatear las transferencias (según cómo las devuelve el contrato)
            const formattedTransferencias = result.map((transferencia) => ({
                from: transferencia.from || transferencia[0],
                to: transferencia.to || transferencia[1],
                fecha: Number(transferencia.fecha || transferencia[2]),
            }));

            setTransferencias(formattedTransferencias);
        } catch (error) {
            console.error("Error al obtener el historial de transferencias:", error.message);
            toast.error("Hubo un problema al procesar tu solicitud.");
        } finally {
            setIsFetching(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-blue-gray-900 text-white rounded-lg shadow-lg p-8 w-[800px] relative flex">
                {/* Botón para cerrar */}
                <button
                    onClick={closeModal}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-lg"
                >
                    &times;
                </button>

                {/* Columna izquierda: Formulario */}
                <div className="w-1/2 pr-4">
                    <h2 className="text-2xl font-light mb-4">Historial de transferencias</h2>

                    <form onSubmit={handleSubmit}>
                        <input
                            type="number"
                            placeholder="Token ID"
                            value={tokenId}
                            onChange={(e) => setTokenId(e.target.value)}
                            className="block w-full text-sm bg-gray-800 text-white p-2 mt-4 rounded"
                            required
                        />
                        <button
                            type="submit"
                            className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
                        >
                            {isFetching ? "Buscando..." : "Ver Historial"}
                        </button>
                    </form>

                    {transferencias.length === 0 && !isFetching && (
                        <p className="mt-4 text-gray-400">No hay transferencias para mostrar.</p>
                    )}
                </div>

                {/* Columna derecha: Lista de transferencias */}
                <div className="w-1/2 pl-4 border-l border-gray-700">
                    {transferencias.length > 0 && (
                        <>
                            <h3 className="text-lg font-light">Transferencias encontradas:</h3>
                            <ul className="mt-2 space-y-2">
                                {transferencias.map((transferencia, index) => (
                                    <li key={index} className="bg-gray-700 p-3 rounded text-sm">
                                        <p><strong>De:</strong> {transferencia.from}</p>
                                        <p><strong>A:</strong> {transferencia.to}</p>
                                        <p>
                                            <strong>Fecha:</strong> {new Date(transferencia.fecha * 1000).toLocaleString()}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default HistorialTransferencias;
