import { useState } from "react";

/**
 * Hook para expor a função de abrir modal para o header
 */
export const useKingdomSectionActions = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return { isModalOpen, openModal, closeModal };
};
