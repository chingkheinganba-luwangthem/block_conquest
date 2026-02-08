//package com.game.block_game.controller;
//
//import java.util.List;
//
//import org.springframework.messaging.handler.annotation.MessageMapping;
//import org.springframework.messaging.handler.annotation.SendTo;
//import org.springframework.stereotype.Controller;
//
//import com.game.block_game.model.Block;
//import com.game.block_game.repo.BlockRepository;
//
//@Controller
//public class BlockWsController {
//
//    private final BlockRepository repo;
//
//    public BlockWsController(BlockRepository repo) {
//        this.repo = repo;
//    }
//
//    @MessageMapping("/claim")
//    @SendTo("/topic/blocks")
//    public List<Block> claimBlock(Block update) {
//
//        Block b = repo.findById(update.getId()).orElseThrow();
//
//        b.setOwner(update.getOwner());
//        b.setColor(update.getColor());
//
//        repo.save(b);
//
//        return repo.findAll(); // send updated grid to everyone
//    }
//}
