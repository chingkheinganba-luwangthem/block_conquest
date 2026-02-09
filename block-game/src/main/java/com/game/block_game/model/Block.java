package com.game.block_game.model;


import jakarta.persistence.*;
// Entity
@Entity
@Table(name = "blocks")
public class Block {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private int rowNum;
    private int colNum;
    private String owner;
    private String color;

    public Block() {}

    public Block(int rowNum, int colNum) {
        this.rowNum = rowNum;
        this.colNum = colNum;
    }

    public Long getId() { return id; }
    public int getRowNum() { return rowNum; }
    public int getColNum() { return colNum; }
    public String getOwner() { return owner; }
    public String getColor() { return color; }

    public void setRowNum(int rowNum) { this.rowNum = rowNum; }
    public void setColNum(int colNum) { this.colNum = colNum; }
    public void setOwner(String owner) { this.owner = owner; }
    public void setColor(String color) { this.color = color; }
}

